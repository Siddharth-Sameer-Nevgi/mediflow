import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActorHospitalId } from "@/lib/ownership";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Prevents: an admin of hospital X reading hospital Y's operating figures.
    // `role === "ADMIN"` above authorises *an* admin, never *this* hospital's
    // admin — the identical defect just fixed in POST /api/queue/emergency. All
    // six aggregates below were unscoped, so every admin account in the
    // database saw the same dashboard: total patients today, completions,
    // no-shows and no-show rate, average wait, a per-department split naming
    // rival hospitals' departments, and a seven-day trend — summed across every
    // hospital in the system. Aggregates, not rows, but that is a competitor's
    // daily throughput and staffing pressure served to anyone with an admin
    // login at any tenant.
    //
    // Resolved from the Admin row rather than the JWT's `hospitalId` claim, so
    // a reassignment or revocation applies on this request — see
    // lib/ownership.ts.
    const hospitalId = await resolveActorHospitalId(session.user.id);

    if (!hospitalId) {
      // An ADMIN-role account with no Admin row, hence no hospital. 404 like
      // every other "nothing here for you"; there is no partial view to serve,
      // and an empty-but-200 dashboard would read as "your hospital had no
      // patients today".
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Appointment carries no `hospitalId`; the hospital hangs off its
    // department (prisma/schema.prisma), so the tenant filter is a relation
    // filter and every query below has to spread it. Written once, so a query
    // added later that forgets it is visibly different from its neighbours.
    const inHospital = { department: { hospitalId } };

    const [
      totalPatientsToday,
      completedToday,
      noShowsToday,
      avgWaitData,
      departmentStats,
      weeklyTrend,
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          ...inHospital,
          scheduledAt: { gte: today, lt: tomorrow },
          deletedAt: null,
        },
      }),
      prisma.appointment.count({
        where: {
          ...inHospital,
          scheduledAt: { gte: today, lt: tomorrow },
          status: "COMPLETED",
        },
      }),
      prisma.appointment.count({
        where: {
          ...inHospital,
          scheduledAt: { gte: today, lt: tomorrow },
          status: "NO_SHOW",
        },
      }),
      prisma.queueEntry.aggregate({
        _avg: { estimatedWaitMins: true },
        // QueueEntry reaches its hospital one hop further out, through the
        // appointment it belongs to.
        where: { createdAt: { gte: today }, appointment: inHospital },
      }),
      prisma.appointment.groupBy({
        by: ["departmentId"],
        _count: true,
        where: {
          ...inHospital,
          scheduledAt: { gte: today, lt: tomorrow },
          deletedAt: null,
        },
      }),
      // Last 7 days trend
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (6 - i));
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          return prisma.appointment
            .count({
              where: {
                ...inHospital,
                scheduledAt: { gte: date, lt: nextDate },
                deletedAt: null,
              },
            })
            .then((count) => ({
              date: date.toLocaleDateString("en-IN", { weekday: "short" }),
              count,
            }));
        })
      ),
    ]);

    // Enrich department stats with names
    const deptIds = departmentStats.map((d) => d.departmentId);
    const departments = await prisma.department.findMany({
      // `hospitalId` is redundant given deptIds already came from a scoped
      // groupBy, and kept anyway: this is the one query that turns ids into
      // names, so an unscoped version of it is what would leak a rival
      // hospital's department names if the query above ever loses its filter.
      where: { id: { in: deptIds }, hospitalId },
      select: { id: true, name: true },
    });
    const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

    const enrichedDeptStats = departmentStats.map((d) => ({
      department: deptMap[d.departmentId] ?? d.departmentId,
      count: d._count,
    }));

    return NextResponse.json({
      totalPatientsToday,
      completedToday,
      noShowsToday,
      avgWaitMins: Math.round(avgWaitData._avg.estimatedWaitMins ?? 0),
      noShowRate:
        totalPatientsToday > 0
          ? Math.round((noShowsToday / totalPatientsToday) * 100)
          : 0,
      departmentStats: enrichedDeptStats,
      weeklyTrend,
    });
  } catch (error) {
    console.error("[GET /admin/analytics]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
