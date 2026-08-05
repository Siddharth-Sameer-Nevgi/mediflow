# MediFlow AI

An AI-assisted hospital OPD queue management system. Patients book appointments and watch their live queue position from anywhere, doctors call the next patient from a real-time dashboard, and hospital admins monitor queues, insert emergency cases, and track analytics.

Built on Next.js 16 (App Router) with a standalone Socket.IO server for real-time queue events.

Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

---

## Features

**Patients**
- Register and log in with an email and password (bcrypt-hashed at rest)
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
| Auth | Auth.js v5 (`next-auth@5` beta) — Credentials provider, email + bcrypt password, JWT sessions, Prisma adapter |
| Real-time | Standalone Express + Socket.IO server ([server/socket-server.ts](server/socket-server.ts)) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| UI | Tailwind CSS v4, Radix UI primitives, `lucide-react`, `recharts`, `sonner` |
| Forms | React Hook Form + Zod v4 |
| Email | Resend (installed but unused — password auth needs no mail) |
| AI | Google Gemini via the REST API (falls back to a deterministic mock provider) |

---

## Project structure

```
app/
  api/                    Route handlers (auth, appointments, queue, AI, admin, notifications)
  patient/ doctor/ admin/ Role-scoped page trees, each with its own layout
  login/ register/        Email + password auth
  page.tsx                Marketing landing page
components/
  shared/                 Sidebar, Topbar, NotificationBell, EditProfileModal
  doctor/                 AvailabilityToggle
  providers.tsx           SessionProvider + QueryClientProvider + ThemeProvider
features/
  queue/                  queue.repository.ts (data access) + queue.service.ts (transactions)
  ai/                     ai.service.ts picks gemini.provider.ts or mock.provider.ts
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
| `AUTH_SECRET` | ✅ | Random 32+ char secret for Auth.js; `openssl rand -base64 32` |
| `AUTH_URL` | ✅ | `http://localhost:3000` in dev |
| `SEED_PASSWORD` | — | Password given to every seeded test account (default `Test@1234`) |
| `RESEND_API_KEY` | — | Not used by authentication — password sign-in needs no email |
| `EMAIL_FROM` | — | Unused by authentication |
| `GEMINI_API_KEY` | — | Omit and the mock AI provider is used. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | — | Model override; defaults to `gemini-2.5-flash` |
| `SOCKET_SERVER_URL` | — | Where route handlers POST emit events (default `http://localhost:3001`) |
| `SOCKET_SERVER_SECRET` | — | Shared bearer token for the socket server's `/emit` endpoint |
| `NEXT_PUBLIC_APP_URL` | — | Used for the socket server's CORS origin |
| `NEXT_PUBLIC_SOCKET_URL` | — | Socket URL the browser connects to |

> The socket URLs and `SOCKET_SERVER_SECRET` have development defaults baked in, so a local run works without them — but set them before deploying.

### 3. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:push       # push schema.prisma to the database
npm run db:seed       # hospital, departments, 4 doctors, 10 patients, 2 admins
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

Enter an email and password on `/login`. No inbox is involved, so the seeded accounts work immediately.

The seed creates **18 test accounts, all sharing one password**:

| Role | Emails | Count |
| --- | --- | --- |
| Patient | `patient@mediflow.ai`, `patient1@` … `patient9@mediflow.ai` | 10 |
| Doctor | `dr.arjun.sharma@`, `dr.priya.nair@`, `dr.rahul.mehta@`, `dr.sana.khan@mediflow.ai` | 4 |
| Admin | `admin@mediflow.ai`, `admin2@mediflow.ai` | 2 |

```
Password for every seeded account:  Test@1234
```

Override it with `SEED_PASSWORD="your-password" npm run db:seed`.

> ⚠️ These are **test fixtures with a shared, publicly-known password**. Never run this seed against a production database.

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

## Authentication

Email + password via **Auth.js v5** (`next-auth@5`), using a Credentials provider with JWT sessions. There is no email round-trip, so the app needs no mail provider to sign users in.

**Flow**

1. `POST /api/auth/register` validates the payload, hashes the password with bcrypt (cost 10), and stores only the hash in `User.passwordHash`. The plaintext is never persisted or logged.
2. The register page then calls `signIn("credentials", …)` with the same details, so a new user lands on their dashboard without a second step.
3. `/login` posts straight to the Credentials provider in [lib/auth.ts](lib/auth.ts), which looks the user up by email and compares with `bcrypt.compare`.

**Rules enforced in [lib/auth.ts](lib/auth.ts)**

| Check | Behaviour |
| --- | --- |
| No `passwordHash` on the account | Sign-in refused — covers accounts provisioned by an admin that have no password yet |
| `deletedAt` set | Sign-in refused (soft-deleted users cannot authenticate) |
| Wrong password | Generic failure; the UI never reveals whether the email exists |
| Password length | Minimum 8 characters, enforced by `registerSchema` in [lib/validations/index.ts](lib/validations/index.ts) |

Role is re-read from the database on every JWT refresh, so a role change takes effect without re-login. `proxy.ts` gates `/patient`, `/doctor`, and `/admin` optimistically; each route handler re-checks `session.user.role` as the authoritative test.

> **Not production-ready as-is.** There is no rate limiting on sign-in attempts, no password-reset flow, and no email verification — `emailVerified` is set `false` on self-registration and `true` only by the seed. Add those before exposing this to real users.

## How the real-time layer works

The Socket.IO server is a separate process, not a Next.js route. It exposes a `/queue` namespace where clients join rooms by identity:

- `patient:<patientId>` and `appointment:<appointmentId>` — via `patient:join`
- `doctor:<doctorId>` — via `doctor:join`
- `admin:<hospitalId>` — via `admin:join`

Next.js never holds a socket connection. Instead, route handlers `POST /emit` to the socket server with a `Bearer ${SOCKET_SERVER_SECRET}` header and an `{ event, room, data }` body. For example, `POST /api/queue/call-next` emits `your_turn_approaching` to the called patient's appointment room and `queue:updated` to the doctor's room. These emits are deliberately non-fatal — if the socket server is down, the API call still succeeds and clients fall back to TanStack Query polling (15–60s depending on the page).

A `GET /health` endpoint on the socket server reports the live connection count.

---

## AI integration

[features/ai/ai.service.ts](features/ai/ai.service.ts) selects a provider at module load: `GeminiProvider` when `GEMINI_API_KEY` is set, otherwise `mockAIProvider`. Both implement the same `AIService` interface, so every consumer works offline and without an API key.

[features/ai/gemini.provider.ts](features/ai/gemini.provider.ts) calls the Gemini REST endpoint with plain `fetch` — no SDK dependency — and requests `responseMimeType: "application/json"` so the model returns bare JSON with no markdown fences to strip. It degrades rather than fails:
 
- Every call has an 8s timeout, because appointment booking awaits the prediction.
- Any error, timeout, or unparseable response falls back to the mock heuristics; the AI is never a hard dependency for booking.
- Triage output is validated against the known department and urgency enums. Anything outside them is discarded and the heuristic result is used instead, so the model can't route a patient to a department that doesn't exist.
- The medical disclaimer is attached in code, never taken from the model.

| Capability | Where it's used |
| --- | --- |
| `triageSymptoms` | `POST /api/ai/triage` — patient booking flow suggests a department |
| `predictWaitTime` | `POST /api/ai/predict-wait` and appointment creation — the estimate itself is arithmetic; Gemini only refines confidence and applies a ±10 min correction |
| `detectNoShowRisk` | Appointment creation — purely statistical, no model call |

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
| `/api/auth/register` | POST | public |
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
- `/api/auth/register` allows **user enumeration**: it returns `409` for an already-registered email. Sign-in itself is safe — it returns a generic failure either way.
- There is no rate limiting on sign-in attempts. `UPSTASH_REDIS_REST_URL` / `_TOKEN` are reserved in `.env.example` for that, but no such code exists yet.
- Registering as `DOCTOR` or `ADMIN` creates the `User` but no matching `Doctor`/`Admin` row, so those accounts land without a profile. Only `PATIENT` self-registration is complete — see [app/api/auth/register/route.ts](app/api/auth/register/route.ts).
- There is no test suite in the repo yet.
