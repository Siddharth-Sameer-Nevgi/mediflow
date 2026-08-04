# MediFlow AI

An AI-assisted hospital OPD queue management system. Patients book appointments and watch their live queue position from anywhere, doctors call the next patient from a real-time dashboard, and hospital admins monitor queues, insert emergency cases, and track analytics.

Built on Next.js 16 (App Router) with a standalone Socket.IO server for real-time queue events.

---

## Features

**Patients**
- Register and log in with an email one-time password (OTP) — no passwords stored
- AI symptom triage that suggests the right department before booking
- Book appointments with an AI-estimated wait time and confidence score
- Live queue page (`/patient/queue/[appointmentId]`) with a token number, position, and push updates when the queue moves
- "Virtual waiting room" flag when the estimated wait exceeds 30 minutes, so patients can wait off-site
- Appointment history and profile management

**Doctors**
- Real-time queue dashboard with a one-click **Call Next** that completes the active consultation, promotes the next patient, opens a consultation log, and re-numbers the rest of the queue in a single transaction
- Availability toggle, appointment list, consultation history, profile editing

**Admins**
- Hospital-wide analytics: patients today, completions, no-shows, average wait, per-department stats, weekly trend charts
- Live multi-doctor queue monitor
- Emergency override that pushes a patient to position 1 and shifts everyone else down, with an audit-log entry
- Hospital, department, and doctor management

**Cross-cutting**
- Role-based routing enforced in [proxy.ts](proxy.ts) (Next.js 16's renamed middleware) for `/patient`, `/doctor`, and `/admin`
- Real-time notification bell backed by Socket.IO plus a polled notifications API
- Soft deletes (`deletedAt`) and an `AuditLog` table for sensitive actions
- Light/dark theming via `next-themes`

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2 (App Router), React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) — built against Neon |
| Auth | Auth.js v5 (`next-auth@5` beta) — Credentials provider with email OTP, JWT sessions, Prisma adapter |
| Real-time | Standalone Express + Socket.IO server ([server/socket-server.ts](server/socket-server.ts)) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| UI | Tailwind CSS v4, Radix UI primitives, `lucide-react`, `recharts`, `sonner` |
| Forms | React Hook Form + Zod v4 |
| Email | Resend (falls back to console logging in dev) |
| AI | Anthropic Claude via the Messages API (falls back to a deterministic mock provider) |

---

## Project structure

```
app/
  api/                    Route handlers (auth, appointments, queue, AI, admin, notifications)
  patient/ doctor/ admin/ Role-scoped page trees, each with its own layout
  login/ register/        OTP auth flow
  page.tsx                Marketing landing page
components/
  shared/                 Sidebar, Topbar, NotificationBell, EditProfileModal
  doctor/                 AvailabilityToggle
  providers.tsx           SessionProvider + QueryClientProvider + ThemeProvider
features/
  queue/                  queue.repository.ts (data access) + queue.service.ts (transactions)
  ai/                     ai.service.ts picks anthropic.provider.ts or mock.provider.ts
hooks/                    useRealtimeNotifications
lib/
  auth.ts                 Auth.js config, JWT/session callbacks, Session type augmentation
  prisma.ts  socket.ts  utils.ts  validations/
prisma/                   schema.prisma + seed.ts
server/socket-server.ts   Socket.IO + internal /emit endpoint
proxy.ts                  Role-based route protection (Next.js 16 middleware)
```

`features/` holds the domain logic: route handlers stay thin and delegate to a service, which owns the Prisma transaction.

---

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon or local)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Random 32+ char secret for Auth.js |
| `AUTH_URL` | ✅ | `http://localhost:3000` in dev |
| `RESEND_API_KEY` | — | Omit in dev and OTPs are printed to the server console instead of emailed |
| `EMAIL_FROM` | — | Sender address for OTP emails |
| `ANTHROPIC_API_KEY` | — | Omit and the mock AI provider is used |
| `SOCKET_SERVER_URL` | — | Where route handlers POST emit events (default `http://localhost:3001`) |
| `SOCKET_SERVER_SECRET` | — | Shared bearer token for the socket server's `/emit` endpoint |
| `NEXT_PUBLIC_APP_URL` | — | Used for the socket server's CORS origin |
| `NEXT_PUBLIC_SOCKET_URL` | — | Socket URL the browser connects to |

> The socket URLs and `SOCKET_SERVER_SECRET` have development defaults baked in, so a local run works without them — but set them before deploying.

### 3. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:push       # push schema.prisma to the database
npm run db:seed       # seed a hospital, departments, doctors, a patient, an admin
```

### 4. Run

```bash
npm run dev:all       # Next.js (:3000) + Socket.IO server (:3001) together
```

Or run them separately:

```bash
npm run dev           # Next.js only
npm run dev:socket    # Socket.IO server only
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Log in

The seed creates pre-verified demo accounts. Enter one of these emails on `/login`, then read the OTP from the terminal running `npm run dev` (or from the `devOtp` field in the API response, which is only returned when `NODE_ENV === "development"`):

| Role | Email |
| --- | --- |
| Patient | `patient@mediflow.ai` |
| Doctor | `dr.arjun.sharma@mediflow.ai` |
| Doctor | `dr.priya.nair@mediflow.ai` |
| Admin | `admin@mediflow.ai` |

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run dev:socket` | Socket.IO server via `ts-node` |
| `npm run dev:all` | Both, via `concurrently` |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

---

## How the real-time layer works

The Socket.IO server is a separate process, not a Next.js route. It exposes a `/queue` namespace where clients join rooms by identity:

- `patient:<patientId>` and `appointment:<appointmentId>` — via `patient:join`
- `doctor:<doctorId>` — via `doctor:join`
- `admin:<hospitalId>` — via `admin:join`

Next.js never holds a socket connection. Instead, route handlers `POST /emit` to the socket server with a `Bearer ${SOCKET_SERVER_SECRET}` header and an `{ event, room, data }` body. For example, `POST /api/queue/call-next` emits `your_turn_approaching` to the called patient's appointment room and `queue:updated` to the doctor's room. These emits are deliberately non-fatal — if the socket server is down, the API call still succeeds and clients fall back to TanStack Query polling (15–60s depending on the page).

A `GET /health` endpoint on the socket server reports the live connection count.

---

## AI integration

[features/ai/ai.service.ts](features/ai/ai.service.ts) selects a provider at module load: `AnthropicProvider` when `ANTHROPIC_API_KEY` is set, otherwise `mockAIProvider`. Both implement the same `AIService` interface, so every consumer works offline and without an API key.

| Capability | Where it's used |
| --- | --- |
| `triageSymptoms` | `POST /api/ai/triage` — patient booking flow suggests a department |
| `predictWaitTime` | `POST /api/ai/predict-wait` and appointment creation — estimated wait + confidence |
| `detectNoShowRisk` | Appointment creation — stored on `Appointment.noShowRisk` |

Free-text symptom input passes through `sanitizeForAI()` in [lib/utils.ts](lib/utils.ts) before it reaches the model, and triage responses carry a medical disclaimer.

> Triage output is a routing suggestion for choosing a department. It is not a diagnosis and is not a substitute for clinical judgment.

---

## Data model

Core tables in [prisma/schema.prisma](prisma/schema.prisma):

- `User` (with `Role`: `PATIENT` | `DOCTOR` | `ADMIN`) → one of `Patient`, `Doctor`, `Admin`
- `Hospital` → `Department` → `Doctor`
- `Appointment` — token number, `AppointmentStatus` (`BOOKED` → `CHECKED_IN` → `IN_CONSULTATION` → `COMPLETED` / `NO_SHOW` / `CANCELLED`), `AppointmentType`, emergency flag, no-show risk
- `QueueEntry` — one per appointment: position, estimated wait, prediction confidence, virtual-waiting-room flag
- `ConsultationLog` — start/end times, the basis for per-doctor average consult duration
- `WaitTimeHistory` — predicted vs. actual wait, for measuring prediction accuracy
- `Notification`, `AuditLog`, `FamilyGroup`

---

## API surface

| Route | Methods | Role |
| --- | --- | --- |
| `/api/auth/register`, `/api/auth/resend-otp` | POST | public |
| `/api/auth/[...nextauth]` | GET/POST | public |
| `/api/appointments` | GET, POST | patient |
| `/api/appointments/[id]/status` | PATCH, DELETE | authenticated |
| `/api/queue/[doctorId]` | GET | authenticated |
| `/api/queue/position/[appointmentId]` | GET | authenticated |
| `/api/queue/call-next` | POST | doctor |
| `/api/queue/emergency` | POST | admin |
| `/api/consultations` | POST | doctor |
| `/api/doctors` / `/api/doctors/me` | GET, POST / GET, PATCH | mixed |
| `/api/departments`, `/api/hospitals` | GET, POST | mixed |
| `/api/notifications`, `/api/notifications/[id]/read` | GET, PATCH | authenticated |
| `/api/user/profile` | GET, PATCH | authenticated |
| `/api/admin/analytics` | GET | admin |

Handlers validate their bodies with Zod schemas from [lib/validations/index.ts](lib/validations/index.ts) and check `session.user.role` before touching the database.

---

## Notes and caveats

- **This is Next.js 16.** Middleware is `proxy.ts` at the project root, not `middleware.ts`. Check `node_modules/next/dist/docs/` before assuming an API matches an older version — see [AGENTS.md](AGENTS.md).
- Role checks in `proxy.ts` are an optimistic redirect layer; the authoritative check is the `session.user.role` guard inside each route handler.
- The socket server's `/emit` endpoint is protected only by a shared secret — keep it on a private network or behind an authenticated gateway in production.
- There is no test suite in the repo yet.
