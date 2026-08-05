import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to .env before seeding.");
}

const pool = new Pool({ connectionString: databaseUrl });

const prisma = new PrismaClient({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: new PrismaPg(pool) as any,
});

/**
 * Shared password for every seeded account, so a whole hospital's worth of
 * users can be exercised without needing real mailboxes.
 *
 * ⚠️ These are TEST fixtures. Never run this seed against production — every
 * account it creates has the same publicly-known password.
 */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Test@1234";

/** Hash once and reuse: bcrypt is deliberately slow, and this runs ~20 times. */
let cachedHash: string | null = null;
async function seedPasswordHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcrypt.hash(SEED_PASSWORD, 10);
  return cachedHash;
}

async function upsertUser(
  email: string,
  name: string,
  role: Role,
  phone?: string
) {
  const passwordHash = await seedPasswordHash();
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, emailVerified: true },
    create: { email, name, role, phone, passwordHash, emailVerified: true },
  });
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
    const user = await upsertUser(docData.email, docData.name, Role.DOCTOR);

    await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        departmentId: deptMap[docData.deptCode].id,
        specialization: docData.specialization,
        licenseNumber: docData.licenseNumber,
        isAvailable: true,
        avgConsultMins: docData.avgConsultMins,
      },
    });
    console.log("✅ Doctor created:", docData.name);
  }

  // Create test patients — enough to exercise queues with real volume.
  const patientsData = [
    { email: "patient@mediflow.ai", name: "Raj Kumar", bloodGroup: "O+" },
    { email: "patient1@mediflow.ai", name: "Ananya Iyer", bloodGroup: "A+" },
    { email: "patient2@mediflow.ai", name: "Vikram Reddy", bloodGroup: "B+" },
    { email: "patient3@mediflow.ai", name: "Meera Joshi", bloodGroup: "AB+" },
    { email: "patient4@mediflow.ai", name: "Farhan Ali", bloodGroup: "O-" },
    { email: "patient5@mediflow.ai", name: "Divya Menon", bloodGroup: "A-" },
    { email: "patient6@mediflow.ai", name: "Karthik Rao", bloodGroup: "B-" },
    { email: "patient7@mediflow.ai", name: "Sneha Kapoor", bloodGroup: "AB-" },
    { email: "patient8@mediflow.ai", name: "Arjun Desai", bloodGroup: "O+" },
    { email: "patient9@mediflow.ai", name: "Ritu Sharma", bloodGroup: "A+" },
  ];

  for (const pt of patientsData) {
    const user = await upsertUser(pt.email, pt.name, Role.PATIENT);
    await prisma.patient.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, bloodGroup: pt.bloodGroup },
    });
  }
  console.log(`✅ ${patientsData.length} test patients created`);

  // Create admin user
  const adminUser = await upsertUser(
    "admin@mediflow.ai",
    "Hospital Admin",
    Role.ADMIN
  );

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      hospitalId: hospital.id,
    },
  });
  console.log("✅ Admin created");

  // A second admin, so admin-to-admin scenarios can be tested.
  const admin2 = await upsertUser(
    "admin2@mediflow.ai",
    "Ops Manager",
    Role.ADMIN
  );
  await prisma.admin.upsert({
    where: { userId: admin2.id },
    update: {},
    create: { userId: admin2.id, hospitalId: hospital.id },
  });
  console.log("✅ Second admin created");

  const total = await prisma.user.count();

  console.log("\n🎉 Database seeded successfully!");
  console.log(`\n🔑 All ${total} accounts share the password: ${SEED_PASSWORD}`);
  console.log("   (override with SEED_PASSWORD=... npm run db:seed)");
  console.log("\n📧 Sign in at /login with any of these:");
  console.log("  Patients: patient@mediflow.ai, patient1@ … patient9@mediflow.ai");
  console.log("  Doctors:  dr.arjun.sharma@mediflow.ai, dr.priya.nair@mediflow.ai,");
  console.log("            dr.rahul.mehta@mediflow.ai, dr.sana.khan@mediflow.ai");
  console.log("  Admins:   admin@mediflow.ai, admin2@mediflow.ai");
  console.log("\n⚠️  These are TEST fixtures with a shared, publicly-known password.");
  console.log("   Never run this seed against a production database.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
