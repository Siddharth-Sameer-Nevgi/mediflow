import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to .env before seeding.");
}

const pool = new Pool({ connectionString: databaseUrl });

const prisma = new PrismaClient({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: new PrismaPg(pool) as any,
});

type SeedRole = "PATIENT" | "DOCTOR" | "ADMIN";

/**
 * Create (or fetch) a Neon Auth user.
 *
 * The seed runs under ts-node, outside Next.js, so it cannot use the Neon Auth
 * SDK's server instance. `neon_auth.user` lives in this same database and the
 * emailOTP flow signs in any existing user by email, so seeding the row
 * directly is enough — the demo accounts sign in with an emailed code, no
 * password or credential row required.
 */
async function upsertAuthUser(
  prisma: PrismaClient,
  email: string,
  name: string,
  role: SeedRole
): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO neon_auth."user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${name}, ${email}, true, ${role}, now(), now())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
    RETURNING id
  `;
  return rows[0].id;
}

async function main() {
  console.log("🌱 Seeding MediFlow database...");

  // Create hospital
  const hospital = await prisma.hospital.upsert({
    where: { id: "clhospital001" },
    update: {},
    create: {
      id: "clhospital001",
      name: "Apollo MediFlow General Hospital",
      address: "123 Healthcare Avenue, Banjara Hills",
      city: "Hyderabad",
      timezone: "Asia/Kolkata",
      isActive: true,
    },
  });
  console.log("✅ Hospital created:", hospital.name);

  // Create departments
  const deptData = [
    { name: "General Medicine", code: "GEN", avgConsultDurationMins: 12 },
    { name: "Cardiology", code: "CARD", avgConsultDurationMins: 20 },
    { name: "Neurology", code: "NEURO", avgConsultDurationMins: 25 },
    { name: "Orthopedics", code: "ORTH", avgConsultDurationMins: 18 },
    { name: "Dermatology", code: "DERM", avgConsultDurationMins: 10 },
    { name: "ENT", code: "ENT", avgConsultDurationMins: 12 },
  ];

  const departments = [];
  for (const dept of deptData) {
    const d = await prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: dept.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        name: dept.name,
        code: dept.code,
        avgConsultDurationMins: dept.avgConsultDurationMins,
        isActive: true,
      },
    });
    departments.push(d);
    console.log("✅ Department created:", d.name);
  }

  const deptMap = Object.fromEntries(departments.map((d) => [d.code, d]));

  // Create doctor users
  const doctorsData = [
    {
      email: "dr.arjun.sharma@mediflow.ai",
      name: "Dr. Arjun Sharma",
      specialization: "Interventional Cardiologist",
      licenseNumber: "MCI-2024-CARD-001",
      deptCode: "CARD",
      avgConsultMins: 20,
    },
    {
      email: "dr.priya.nair@mediflow.ai",
      name: "Dr. Priya Nair",
      specialization: "General Physician & Family Medicine",
      licenseNumber: "MCI-2024-GEN-002",
      deptCode: "GEN",
      avgConsultMins: 12,
    },
    {
      email: "dr.rahul.mehta@mediflow.ai",
      name: "Dr. Rahul Mehta",
      specialization: "Neurologist & Epileptologist",
      licenseNumber: "MCI-2024-NEURO-003",
      deptCode: "NEURO",
      avgConsultMins: 25,
    },
    {
      email: "dr.sana.khan@mediflow.ai",
      name: "Dr. Sana Khan",
      specialization: "Orthopedic Surgeon",
      licenseNumber: "MCI-2024-ORTH-004",
      deptCode: "ORTH",
      avgConsultMins: 18,
    },
  ];

  for (const docData of doctorsData) {
    const userId = await upsertAuthUser(
      prisma,
      docData.email,
      docData.name,
      "DOCTOR"
    );

    await prisma.doctor.upsert({
      where: { userId },
      update: { name: docData.name, email: docData.email },
      create: {
        userId,
        name: docData.name,
        email: docData.email,
        departmentId: deptMap[docData.deptCode].id,
        specialization: docData.specialization,
        licenseNumber: docData.licenseNumber,
        isAvailable: true,
        avgConsultMins: docData.avgConsultMins,
      },
    });
    console.log("✅ Doctor created:", docData.name);
  }

  // Create a sample patient
  const patientId = await upsertAuthUser(
    prisma,
    "patient@mediflow.ai",
    "Raj Kumar",
    "PATIENT"
  );

  await prisma.patient.upsert({
    where: { userId: patientId },
    update: { name: "Raj Kumar", email: "patient@mediflow.ai" },
    create: {
      userId: patientId,
      name: "Raj Kumar",
      email: "patient@mediflow.ai",
      bloodGroup: "O+",
    },
  });
  console.log("✅ Sample patient created");

  // Create admin user
  const adminId = await upsertAuthUser(
    prisma,
    "admin@mediflow.ai",
    "Hospital Admin",
    "ADMIN"
  );

  await prisma.admin.upsert({
    where: { userId: adminId },
    update: { name: "Hospital Admin", email: "admin@mediflow.ai" },
    create: {
      userId: adminId,
      name: "Hospital Admin",
      email: "admin@mediflow.ai",
      hospitalId: hospital.id,
    },
  });
  console.log("✅ Admin created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📧 Demo accounts (OTP sign-in — the code is emailed, so these addresses must be deliverable):");
  console.log("  Patient: patient@mediflow.ai");
  console.log("  Doctor: dr.arjun.sharma@mediflow.ai");
  console.log("  Doctor: dr.priya.nair@mediflow.ai");
  console.log("  Admin: admin@mediflow.ai");
  console.log("\n  Note: These accounts are pre-verified, but sign-in still requires receiving");
  console.log("  the emailed OTP. Change these to addresses you control before testing login.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
