import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { generateOTP } from "@/lib/utils";


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

    const { name, email, phone, role } = parsed.data;

    // Check if user already exists and is verified
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerified) {
      return NextResponse.json(
        { error: "Email already registered. Please login." },
        { status: 409 }
      );
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert user (allow re-registration if not yet verified)
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        phone,
        role,
        otpCode: otp,
        otpExpiresAt,
      },
      create: {
        name,
        email,
        phone,
        role,
        otpCode: otp,
        otpExpiresAt,
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

    // Send OTP via email
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "noreply@mediflow.ai",
        to: email,
        subject: "Your MediFlow OTP Code",
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
            <h1 style="color: #0EA5E9; margin-bottom: 8px;">MediFlow AI</h1>
            <p style="color: #334155; font-size: 16px;">Hi ${name}, welcome to MediFlow!</p>
            <p style="color: #64748b;">Your one-time verification code is:</p>
            <div style="background: #0EA5E9; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 24px; border-radius: 8px; letter-spacing: 12px; margin: 24px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes. Do not share this code with anyone.</p>
          </div>
        `,
      });
    } else {
      // Dev mode — log OTP to console
      console.log(`\n🔑 [DEV] OTP for ${email}: ${otp}\n`);
    }

    return NextResponse.json({
      message: "OTP sent successfully",
      email,
      // Only expose OTP in dev for testing
      ...(process.env.NODE_ENV === "development" && { devOtp: otp }),
    });
  } catch (error) {
    console.error("[Register]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
