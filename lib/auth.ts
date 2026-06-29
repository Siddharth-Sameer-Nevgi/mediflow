import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email } = parsed.data;
        const otp = credentials?.otp as string;

        if (!otp || otp.length !== 6) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { doctor: true, patient: true, admin: true },
        });

        if (!user) return null;
        if (!user.otpCode) return null;
        if (user.otpExpiresAt && user.otpExpiresAt < new Date()) return null;
        if (user.otpCode !== otp) return null;

        // Clear OTP after successful use
        await prisma.user.update({
          where: { id: user.id },
          data: {
            otpCode: null,
            otpExpiresAt: null,
            emailVerified: true,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role;
      }

      // Always fetch latest user data from DB to get role
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: { admin: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.hospitalId = dbUser.admin?.hospitalId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.hospitalId = token.hospitalId as string | undefined;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      hospitalId?: string;
    };
  }
}
