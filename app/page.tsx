import Link from "next/link";
import {
  Activity,
  Brain,
  Clock,
  Shield,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Bell,
  Stethoscope,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">MediFlow AI</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-400 hover:text-white transition-colors text-sm">
              Features
            </a>
            <a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors text-sm">
              How it Works
            </a>
            <a href="#roles" className="text-slate-400 hover:text-white transition-colors text-sm">
              For Your Role
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-slate-300 hover:text-white text-sm transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="bg-sky-500 hover:bg-sky-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-sky-500/25"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "linear-gradient(rgba(14,165,233,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.4) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-full px-4 py-1.5 mb-8">
            <Brain className="w-4 h-4 text-sky-400" />
            <span className="text-sky-300 text-sm font-medium">
              AI-Powered Healthcare Operations
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">The Future of</span>
            <br />
            <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Hospital Queue Management
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            MediFlow AI eliminates waiting room chaos with real-time queue
            tracking, AI-powered wait predictions, and seamless patient flow
            across every department.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-2xl hover:shadow-sky-500/30 hover:-translate-y-0.5"
            >
              Start for Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-slate-700 hover:border-slate-600"
            >
              View Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: "40%", label: "Reduced Wait Time" },
              { value: "94%", label: "Prediction Accuracy" },
              { value: "3×", label: "Faster Patient Flow" },
              { value: "99.9%", label: "Uptime SLA" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur"
              >
                <div className="text-3xl font-bold text-sky-400">
                  {stat.value}
                </div>
                <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need to Run{" "}
              <span className="text-sky-400">Smarter Hospitals</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From AI triage to real-time analytics, MediFlow covers the entire
              patient journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                color: "from-purple-500 to-violet-600",
                title: "AI Triage Assistant",
                description:
                  "Patients describe symptoms in plain language. Our AI instantly recommends the right department with urgency scoring — no forms, no guessing.",
              },
              {
                icon: Clock,
                color: "from-sky-500 to-blue-600",
                title: "Wait Time Prediction",
                description:
                  "Hybrid AI engine combines queue dynamics, appointment types, and historical data to deliver minute-accurate wait time estimates with confidence scores.",
              },
              {
                icon: Activity,
                color: "from-emerald-500 to-teal-600",
                title: "Live Queue Tracking",
                description:
                  "Patients see their real-time position, token number, and estimated call time — all updated instantly via WebSocket as the queue moves.",
              },
              {
                icon: BarChart3,
                color: "from-amber-500 to-orange-600",
                title: "Admin Analytics",
                description:
                  "Hospital-wide operational dashboards with patient volume trends, department utilization, no-show risk, and crowd density heatmaps.",
              },
              {
                icon: Shield,
                color: "from-rose-500 to-red-600",
                title: "Emergency Override",
                description:
                  "Admins can instantly move critical patients to the front of any queue with full audit logging and automatic notification to affected patients.",
              },
              {
                icon: Bell,
                color: "from-cyan-500 to-sky-600",
                title: "Smart Notifications",
                description:
                  "Patients get alerted when their turn is approaching, doctors notified of emergencies, and admins informed of SLA breaches — all in real time.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/50 backdrop-blur"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-4 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              From Arrival to{" "}
              <span className="text-sky-400">Consultation in 3 Steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Stethoscope,
                title: "Describe Symptoms",
                description:
                  "Patient opens MediFlow, types symptoms in plain language. AI triage instantly recommends the right department.",
              },
              {
                step: "02",
                icon: Users,
                title: "Book & Track",
                description:
                  "Select a doctor, see live ETAs, and get a token number. Leave and come back when your turn is near — we'll notify you.",
              },
              {
                step: "03",
                icon: Zap,
                title: "Seamless Consultation",
                description:
                  "Doctor clicks Call Next, patient arrives, timer starts. Consultation logged automatically for analytics.",
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+48px)] right-[calc(-50%+48px)] h-px bg-gradient-to-r from-sky-500/50 to-transparent" />
                )}
                <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 mb-4">
                  <step.icon className="w-10 h-10 text-sky-400" />
                  <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Built for <span className="text-sky-400">Every Role</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                role: "Patient",
                color: "sky",
                icon: Users,
                features: [
                  "AI symptom triage",
                  "Real-time queue position",
                  "Virtual waiting room",
                  "Turn-approaching alerts",
                  "Appointment history",
                ],
                cta: "Register as Patient",
                href: "/register?role=PATIENT",
              },
              {
                role: "Doctor",
                color: "emerald",
                icon: Stethoscope,
                features: [
                  "Today's full queue view",
                  "One-click Call Next",
                  "Consultation timer",
                  "Emergency patient badges",
                  "Patient notes access",
                ],
                cta: "Register as Doctor",
                href: "/register?role=DOCTOR",
              },
              {
                role: "Hospital Admin",
                color: "violet",
                icon: BarChart3,
                features: [
                  "Live operational dashboard",
                  "Emergency queue override",
                  "No-show risk scoring",
                  "Department analytics",
                  "Crowd density heatmaps",
                ],
                cta: "Register as Admin",
                href: "/register?role=ADMIN",
              },
            ].map((r) => (
              <div
                key={r.role}
                className={`relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-${r.color}-500/50 transition-all backdrop-blur`}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-${r.color}-500/20 flex items-center justify-center mb-4`}
                >
                  <r.icon className={`w-6 h-6 text-${r.color}-400`} />
                </div>
                <h3 className="text-white font-bold text-xl mb-4">{r.role}</h3>
                <ul className="space-y-2 mb-6">
                  {r.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-slate-400 text-sm">
                      <CheckCircle2 className={`w-4 h-4 text-${r.color}-400 shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={r.href}
                  className={`block w-full text-center bg-${r.color}-500/20 hover:bg-${r.color}-500/30 text-${r.color}-300 border border-${r.color}-500/30 py-2.5 rounded-lg text-sm font-medium transition-all`}
                >
                  {r.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-sky-600/20 to-blue-800/20 border border-sky-500/20 rounded-3xl p-12 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Transform Your Hospital?
            </h2>
            <p className="text-slate-400 mb-8 text-lg">
              Join forward-thinking hospitals using MediFlow AI to cut wait
              times, reduce no-shows, and improve patient satisfaction.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:shadow-2xl hover:shadow-sky-500/30"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-400 text-sm">
              MediFlow AI — Healthcare Operations Platform
            </span>
          </div>
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} MediFlow AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
