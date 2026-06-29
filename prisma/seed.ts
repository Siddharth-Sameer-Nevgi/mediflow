import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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
    const user = await prisma.user.upsert({
      where: { email: docData.email },
      update: {},
      create: {
        email: docData.email,
        name: docData.name,
        role: Role.DOCTOR,
        emailVerified: true,
        // No OTP needed for seeded accounts
      },
    });

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

  // Create a sample patient
  const patientUser = await prisma.user.upsert({
    where: { email: "patient@mediflow.ai" },
    update: {},
    create: {
      email: "patient@mediflow.ai",
      name: "Raj Kumar",
      role: Role.PATIENT,
      emailVerified: true,
    },
  });

  await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      bloodGroup: "O+",
    },
  });
  console.log("✅ Sample patient created");

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@mediflow.ai" },
    update: {},
    create: {
      email: "admin@mediflow.ai",
      name: "Hospital Admin",
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      hospitalId: hospital.id,
    },
  });
  console.log("✅ Admin created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📧 Demo accounts (use OTP login with the email — OTP will be printed to console):");
  console.log("  Patient: patient@mediflow.ai");
  console.log("  Doctor: dr.arjun.sharma@mediflow.ai");
  console.log("  Doctor: dr.priya.nair@mediflow.ai");
  console.log("  Admin: admin@mediflow.ai");
  console.log("\n  Note: These accounts are pre-verified. Use the login page with these emails.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
