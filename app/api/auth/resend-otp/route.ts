import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resendOtpSchema } from "@/lib/validations";
import { generateOTP } from "@/lib/utils";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: "User not found. Please register first." }, { status: 404 });
    }

    // Allow both verified (login) and unverified (registration) users to get OTPs

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpCode: otp, otpExpiresAt },
    });

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "noreply@mediflow.ai",
        to: email,
        subject: "Your MediFlow OTP Code (Resent)",
        html: `<p>Your new OTP is: <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
      });
    } else {
      console.log(`\n🔑 [DEV] Resent OTP for ${email}: ${otp}\n`);
    }

    return NextResponse.json({
      message: "OTP resent successfully",
      ...(process.env.NODE_ENV === "development" && { devOtp: otp }),
    });
  } catch (error) {
    console.error("[Resend OTP]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
