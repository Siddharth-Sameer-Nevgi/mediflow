import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, phone, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered. Please login." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        passwordHash,
        // No email round-trip in this flow, so the address is unverified.
        emailVerified: false,
      },
    });

    // Create role-specific profile
    if (role === "PATIENT") {
      await prisma.patient.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    }

    return NextResponse.json({
      message: "Account created successfully",
      email,
    });
  } catch (error) {
    console.error("[Register]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
