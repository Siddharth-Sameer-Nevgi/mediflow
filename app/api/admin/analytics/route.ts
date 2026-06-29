import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalPatientsToday,
      completedToday,
      noShowsToday,
      avgWaitData,
      departmentStats,
      weeklyTrend,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { scheduledAt: { gte: today, lt: tomorrow }, deletedAt: null },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: today, lt: tomorrow },
          status: "COMPLETED",
        },
      }),
      prisma.appointment.count({
        where: {
          scheduledAt: { gte: today, lt: tomorrow },
          status: "NO_SHOW",
        },
      }),
      prisma.queueEntry.aggregate({
        _avg: { estimatedWaitMins: true },
        where: { createdAt: { gte: today } },
      }),
      prisma.appointment.groupBy({
        by: ["departmentId"],
        _count: true,
        where: { scheduledAt: { gte: today, lt: tomorrow }, deletedAt: null },
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
      where: { id: { in: deptIds } },
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
