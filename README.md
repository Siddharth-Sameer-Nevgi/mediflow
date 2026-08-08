# MediFlow

An AI-assisted hospital OPD queue management system. Patients book appointments and watch their live queue position from anywhere, doctors call the next patient from a real-time dashboard, and hospital admins monitor queues, insert emergency cases, and track analytics.

Built on Next.js 16 (App Router) with a standalone Socket.IO server for real-time queue events.

Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

> **Not production-ready as-is.** Specifically: no rate limiting on sign-in, no
> password reset, no email verification, **no test suite**, and no
> observability — no metrics, no tracing, no structured logging or error
> reporting; diagnosis today means reading `console.error` output. The
> [Security posture](#security-posture) section below states plainly what is and
> is not enforced.

---

## Features

**Patients**
- Register and log in with an email and password (bcrypt-hashed at rest)
- AI symptom triage that suggests a department before booking
- Book appointments with an estimated wait time and a confidence score
- Live queue page (`/patient/queue/[appointmentId]`) with a token number and position, updated over WebSocket when the queue changes
- "Virtual waiting room" flag when the estimated wait exceeds 30 minutes, so patients can wait off-site
- Appointment history and profile management

**Doctors**
- Real-time queue dashboard with a one-click **Call Next** that completes the active consultation, promotes the next patient, opens a consultation log, and re-numbers the rest of the queue in a single transaction
- Availability toggle, appointment list, consultation history, profile editing

**Admins**
- Hospital-wide analytics: patients booked today, completions, no-shows, average estimated wait, per-department stats, weekly trend chart
- Live multi-doctor queue monitor
- Emergency override that pushes a patient to position 1 and shifts everyone else down, with an audit-log entry
- Hospital, department, and doctor management

**Cross-cutting**
- Role-based routing enforced in [proxy.ts](proxy.ts) (Next.js 16's renamed middleware) for `/patient`, `/doctor`, and `/admin`
- Socket.IO notifications plus a polled notifications API
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
  page.tsx                Landing page
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
  env.ts                  Required server env, validated with Zod at startup
  env.public.ts           Required NEXT_PUBLIC_* env, validated in the browser
  prisma.ts  socket.ts  utils.ts  date.ts  validations/
prisma/                   schema.prisma + hand-written migrations + seed.ts
scripts/                  measure-booking-contention.ts (reproduces the numbers cited in code comments)
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
| `DIRECT_URL` | ✅ for migrations | Unpooled endpoint. `prisma migrate` takes a session-level advisory lock, which transaction pooling cannot hold across statements |
| `AUTH_SECRET` | ✅ | Random 32+ char secret for Auth.js; `openssl rand -base64 32`. Also the secret the socket server verifies handshakes against |
| `AUTH_URL` | ✅ | `http://localhost:3000` in dev |
| `SOCKET_SERVER_URL` | ✅ | Where route handlers POST emit events |
| `SOCKET_SERVER_SECRET` | ✅ | Bearer token for the socket server's `/emit` endpoint; `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | The socket server's CORS origin |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | Socket URL the browser connects to |
| `SOCKET_PORT` | — | Port the socket server listens on (defaults to `3001`) |
| `SEED_PASSWORD` | — | Password given to every seeded test account (default `Test@1234`) |
| `RESEND_API_KEY` | — | Not used by authentication — password sign-in needs no email |
| `EMAIL_FROM` | — | Unused by authentication |
| `GEMINI_API_KEY` | — | Omit and the mock AI provider is used. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | — | Model override; defaults to `gemini-2.5-flash` |

The required variables above have **no code-level defaults**.
[lib/env.ts](lib/env.ts) validates them with Zod and throws on startup if any is
missing, and [lib/env.public.ts](lib/env.public.ts) does the same for the
`NEXT_PUBLIC_*` pair. `SOCKET_SERVER_SECRET` previously fell back to a literal
string committed to this repository, which meant a missing variable left the
`/emit` endpoint writable by anyone who had read the source; `lib/env.ts` now
rejects that specific value as well as an absent one.

Note that the socket server loads `.env` (via `dotenv`) while Next.js prefers
`.env.local`. If you keep both files, `SOCKET_SERVER_SECRET` must match in each
or `/emit` calls will 401.

### 3. Set up the database

```bash
npm run db:generate       # generate the Prisma client
npx prisma migrate deploy # apply prisma/migrations
npm run db:seed           # hospital, departments, 4 doctors, 10 patients, 2 admins
```

Use `prisma migrate deploy`, **not** `db push`. Two of the constraints this
project relies on are hand-written SQL that `schema.prisma` cannot express, so
`db push` produces a database that looks correct and silently permits duplicate
bookings — see [Concurrency](#concurrency).

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
| `npm run db:push` | Sync `schema.prisma` to the database — **skips the hand-written indexes**, prefer `prisma migrate deploy` |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run measure:contention` | Measures database round-trip time and how many concurrent token allocations collide with and without the advisory lock. Reproduces the figures quoted in the comments in [app/api/appointments/route.ts](app/api/appointments/route.ts) and in [Concurrency](#concurrency) |

---

## Concurrency

Two independent guards protect appointment booking. They defend different
invariants, so both exist.

### 1. Token allocation — advisory lock + unique index

Token numbers restart at 1 per doctor per calendar day. Allocation reads
`MAX(tokenNumber)` and inserts `MAX + 1`, which is a read-modify-write.

- A transaction-scoped **advisory lock** on `hashtext(doctorId + ":" + day)`
  serialises allocation for that one doctor-day, so each caller reads a maximum
  that already includes its predecessors.
- A **unique index** `Appointment_doctorId_scheduledDate_tokenNumber_key`
  ([migration](prisma/migrations/20260805120000_scope_token_numbers_per_doctor_day/migration.sql))
  is the backstop. It holds even if the lock is skipped, the code is rewritten,
  or a second service writes to the table.

The race it prevents:

```
A: SELECT MAX(tokenNumber) -> 7        B: SELECT MAX(tokenNumber) -> 7
A: INSERT tokenNumber = 8  (commits)   B: INSERT tokenNumber = 8  (rejected)
```

Without the lock both callers read 7 and one is rejected on the index; with it, B
blocks until A commits, reads 8, and inserts 9 — both patients get a distinct
token. `scripts/measure-booking-contention.ts` runs exactly this, with the lock
off and then on, and prints the outcome for your database:

```bash
npm run measure:contention
```

Every figure quoted in this section and in the comments in
[app/api/appointments/route.ts](app/api/appointments/route.ts) — the 270ms median
round-trip, 2-of-10 committing without the lock and 10-of-10 with it, the ~18
concurrent bookings the 30s transaction timeout absorbs — came from that one
command. They move with latency and concurrency, so re-run it against your own
database rather than trusting the numbers here.

A rejection on the index is retried up to five times, since re-reading the
maximum yields a fresh candidate. Exhausting the retries returns `409`.

### 2. Duplicate bookings — partial unique index only

One patient may not hold two live appointments with the same doctor on the same
day. `Appointment_patient_doctor_day_active_key`
([migration](prisma/migrations/20260808120000_prevent_duplicate_active_bookings/migration.sql))
is a **partial** unique index on `(patientId, doctorId, scheduledDate)`
restricted to rows with `deletedAt IS NULL` and status in `BOOKED`,
`CHECKED_IN`, or `IN_CONSULTATION` — so cancelling and re-booking still works.
Prisma has no syntax for a `WHERE` clause on an index, which is why it is raw SQL
rather than `@@unique`.

The race it prevents:

```
A: INSERT (patient P, doctor D, today)  (commits)
B: INSERT (patient P, doctor D, today)  (rejected — 409, not retried)
```

**No advisory lock here, deliberately.** All three key columns are known before
the transaction opens, so there is no read-modify-write to serialise; the index
alone decides the race. Unlike a token collision, retrying cannot help — the
loser would re-insert identical values — so it returns `409` immediately.

A cheap pre-check runs before the transaction opens so the ordinary case (a
patient re-submitting a form) costs one indexed `SELECT` instead of two AI calls
and a transaction that queues on the advisory lock only to be rejected. The
index, not the pre-check, is the authority.

### Distinguishing the two

`Appointment` now has two unique constraints, so a Prisma `P2002` has to be
attributed by index name before deciding whether to retry — a duplicate booking
misread as a token collision would be retried five times and then returned as a
`409` blaming queue contention. `classifyBookingConflict()` in
[app/api/appointments/route.ts](app/api/appointments/route.ts) reads the index
name out of `error.meta`, where the `pg` driver adapter puts the original
Postgres message. It deliberately does not search `error.message`: Prisma inlines
a snippet of the calling source file there, and that snippet mentions both
`tokenNumber` and `patientId`.

---

## Security posture

**Enforced**

| Control | Where |
| --- | --- |
| Passwords bcrypt-hashed (cost 10); plaintext never stored or logged | [app/api/auth/register/route.ts](app/api/auth/register/route.ts), [lib/password.ts](lib/password.ts) |
| Sign-in refused for accounts with no `passwordHash` or with `deletedAt` set | [lib/auth.ts](lib/auth.ts) |
| Generic sign-in failure — the UI never reveals whether an email exists | [lib/auth.ts](lib/auth.ts) |
| Role re-read from the database on every JWT refresh, so a role change applies without re-login | [lib/auth.ts](lib/auth.ts) |
| Every route handler re-checks `session.user.role` before touching the database | `app/api/**` |
| Request bodies validated with Zod | [lib/validations/index.ts](lib/validations/index.ts) |
| Socket.IO handshake authenticated against `AUTH_SECRET`; unauthenticated connections rejected | [server/socket-server.ts](server/socket-server.ts) |
| Socket rooms derived from the session, never from client arguments; role checked per room; appointment ownership verified before joining `appointment:<id>` | [server/socket-server.ts](server/socket-server.ts) |
| Required secrets have no fallback values — startup fails instead | [lib/env.ts](lib/env.ts) |
| Free-text symptom input sanitised before reaching the model; triage output validated against known enums | [lib/utils.ts](lib/utils.ts), [features/ai/gemini.provider.ts](features/ai/gemini.provider.ts) |
| Sensitive actions written to `AuditLog` (booking, call-next, emergency override, status changes) | `app/api/**`, [features/queue/queue.service.ts](features/queue/queue.service.ts) |

**Not enforced**

| Gap | Detail |
| --- | --- |
| Rate limiting | None, anywhere — including sign-in and registration. `UPSTASH_REDIS_REST_URL` / `_TOKEN` are reserved in `.env.example` but no such code exists |
| User enumeration on registration | `/api/auth/register` returns `409` for an already-registered email. Sign-in itself is safe |
| `/emit` authorisation granularity | A shared bearer token with no scoping: any holder can emit any event into any room. Keep the socket server off the public internet |
| Object-level authorisation on reads | `GET /api/queue/position/[appointmentId]` and `GET /api/queue/[doctorId]` check that the caller is signed in, not that the record is theirs. Any authenticated user can read any appointment's position |
| Appointment mutation ownership | `DELETE /api/appointments/[id]` checks only that the caller is signed in, so any authenticated user can cancel any appointment by id |
| Password reset / email verification | Neither exists. `emailVerified` is `false` on self-registration and `true` only from the seed |
| Session revocation | JWT sessions with no server-side session store, so a token stays valid until it expires |
| Automated security testing | No test suite, no dependency scanning, no CI |

### How socket authentication works

The `/queue` namespace runs a handshake middleware that reads the Auth.js session
cookie from the handshake request and decrypts it with the same `AUTH_SECRET`
Auth.js used to issue it. A connection with no cookie, an expired cookie, or a
forged one is rejected with `unauthenticated`; the verified `userId` and `role`
are attached to `socket.data`.

The cookie was chosen over an `auth: { token }` handshake payload because the
session cookie is `httpOnly`: browser JavaScript cannot read it, so a payload
token would require a second Next.js endpoint that hands the session out to
client code. The consequence is that the socket server must sit at an origin the
browser will send the session cookie to — same site as the app, any port — and
the client sets `withCredentials`.

Join events take **no identity arguments**. `patient:join`, `doctor:join`, and
`admin:join` resolve the patient, doctor, and hospital id from the authenticated
user, and each checks the role from the verified token. `patient:join` accepts an
`appointmentId`, but joins `appointment:<id>` only after confirming the row
belongs to that patient — previously any browser could name any room and read
another patient's queue events.

---

## How the real-time layer works

The Socket.IO server is a separate process, not a Next.js route. It exposes an
authenticated `/queue` namespace whose rooms are:

- `patient:<patientId>` and `appointment:<appointmentId>` — via `patient:join`
- `doctor:<doctorId>` — via `doctor:join`
- `admin:<hospitalId>` — via `admin:join`

Next.js never holds a socket connection. Instead, route handlers `POST /emit` to the socket server with a `Bearer ${SOCKET_SERVER_SECRET}` header and an `{ event, room, data }` body. For example, `POST /api/queue/call-next` emits `your_turn_approaching` to the called patient's appointment room and `queue:updated` to the doctor's room. These emits are deliberately non-fatal — if the socket server is down, the API call still succeeds and clients fall back to TanStack Query polling (15–60s depending on the page).

`admin:<hospitalId>` rooms are joinable but nothing currently emits into them; the admin queue monitor relies on polling.

A `GET /health` endpoint on the socket server reports the live connection count.

---

## AI integration

[features/ai/ai.service.ts](features/ai/ai.service.ts) selects a provider at module load: `GeminiProvider` when `GEMINI_API_KEY` is set, otherwise `mockAIProvider`. Both implement the same `AIService` interface, so every consumer works offline and without an API key. There is one provider call per capability — no ensemble, no model chaining.

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

Prediction quality is not measured. Nothing compares a prediction against the actual wait, so there is no accuracy figure to quote — see the note on `WaitTimeHistory` below.

---

## Data model

Core tables in [prisma/schema.prisma](prisma/schema.prisma):

- `User` (with `Role`: `PATIENT` | `DOCTOR` | `ADMIN`) → one of `Patient`, `Doctor`, `Admin`
- `Hospital` → `Department` → `Doctor`
- `Appointment` — token number, `AppointmentStatus` (`BOOKED` → `CHECKED_IN` → `IN_CONSULTATION` → `COMPLETED` / `NO_SHOW` / `CANCELLED`), `AppointmentType`, emergency flag, no-show risk, plus `scheduledDate` (the calendar day in the hospital's time zone) which scopes both unique constraints
- `QueueEntry` — one per appointment: position, estimated wait, prediction confidence, virtual-waiting-room flag
- `ConsultationLog` — start/end times, the basis for per-doctor average consult duration
- `Notification`, `AuditLog`
- `WaitTimeHistory` and `FamilyGroup` — **declared but never written to.** No code path populates them, so `WaitTimeHistory` cannot back any accuracy claim and `FamilyGroup` is a schema stub

---

## API surface

| Route | Methods | Role |
| --- | --- | --- |
| `/api/auth/register` | POST | public |
| `/api/auth/[...nextauth]` | GET/POST | public |
| `/api/appointments` | GET, POST | patient |
| `/api/appointments/[id]/status` | PATCH, DELETE | doctor / authenticated |
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

Handlers validate their bodies with Zod schemas from [lib/validations/index.ts](lib/validations/index.ts) and check `session.user.role` before touching the database. Role is the only check on most of them — see the object-level authorisation gaps in [Security posture](#security-posture).

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

---

## Notes and caveats

- **This is Next.js 16.** Middleware is `proxy.ts` at the project root, not `middleware.ts`. Check `node_modules/next/dist/docs/` before assuming an API matches an older version — see [AGENTS.md](AGENTS.md).
- Role checks in `proxy.ts` are an optimistic redirect layer; the authoritative check is the `session.user.role` guard inside each route handler.
- `QueueEntry.position` is written at booking time and recomputed on `call-next` and on the emergency override, but **not** when an appointment is cancelled, soft-deleted, or marked `NO_SHOW`. Those paths leave gaps in the sequence, so a patient can be shown a position number higher than the count of people actually ahead of them. Positions are also stored per doctor with no day scoping, so entries from different days share one numbering space.
- Registering as `DOCTOR` or `ADMIN` creates the `User` but no matching `Doctor`/`Admin` row, so those accounts land without a profile. Only `PATIENT` self-registration is complete — see [app/api/auth/register/route.ts](app/api/auth/register/route.ts). A doctor or admin in that state also cannot join a socket room, since the room id is derived from the missing profile row.
- `insertEmergency()` and `updateQueuePositions()` in `features/queue/` are unreferenced. `/api/queue/emergency` reimplements the former inline with different semantics.
- `npm run lint` reports pre-existing errors (unescaped entities, `prefer-const`, a component created during render, an `<a>` where `<Link>` belongs). None come from the concurrency or socket work.
- There is no test suite in the repo yet.
