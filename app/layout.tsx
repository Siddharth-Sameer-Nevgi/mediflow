import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MediFlow — Smart Hospital Queue Management",
    template: "%s | MediFlow",
  },
  description:
    "Hospital OPD queue management: live queue positions over WebSocket, AI-assisted symptom triage, and wait-time estimates with a confidence score.",
  keywords: ["hospital queue", "patient flow", "medical AI", "wait time prediction", "healthcare"],
  openGraph: {
    title: "MediFlow",
    description: "Hospital OPD queue management with live queue tracking",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
