import type { Metadata } from "next";

export const metadata: Metadata = { title: "Register | MediFlow" };

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      {children}
    </div>
  );
}
