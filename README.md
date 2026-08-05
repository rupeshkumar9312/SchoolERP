# School ERP

A school management system built module by module. Current state: **Module 0 (Project Setup) complete** — backend, frontend and database run end to end.

- **Backend** — NestJS 11 + Prisma 6 + PostgreSQL
- **Frontend** — React 19 + Vite 6 + TypeScript
- **CI** — GitHub Actions (lint + build + e2e for both apps)

---

## Quick start

Prerequisites: Node.js 20+, PostgreSQL 14+ (or Docker).

```bash
git clone <repo> && cd SchoolERP
```

**1. Start PostgreSQL** — either Docker:

```bash
docker compose up -d db
```

…or a local install (Homebrew):

```bash
brew services start postgresql@14 && createdb school_erp
```

**2. Backend**

```bash
cd backend && cp .env.example .env && npm install && npm run start:dev
```

Edit `.env` first: point `DATABASE_URL` at your database and set the two JWT secrets (`openssl rand -base64 32`). The API boots on <http://localhost:3000/api>.

**3. Frontend** (separate terminal)

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

Open <http://localhost:5173>. The landing page calls `GET /api/health` and shows the API and database status.

### Verify

```bash
curl -s http://localhost:3000/api/health
```

```json
{
  "status": "ok",
  "service": "school-erp-api",
  "uptime": 12,
  "timestamp": "2026-08-05T00:00:00.000Z",
  "dependencies": { "database": { "status": "up" } }
}
```

---

## Layout

```
SchoolERP/
├── backend/                  NestJS API
│   ├── prisma/schema.prisma  DB schema (models land in Module 1)
│   ├── src/
│   │   ├── config/           env validation — fails fast on a bad .env
│   │   ├── health/           GET /api/health
│   │   ├── prisma/           global PrismaService (+ ping for health)
│   │   ├── app.module.ts
│   │   └── main.ts           global /api prefix, ValidationPipe, CORS
│   └── test/                 e2e specs
├── frontend/                 React + Vite
│   └── src/api/              typed fetch client
├── .github/workflows/ci.yml
└── docker-compose.yml        PostgreSQL 16
```

### Backend scripts

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Dev server with watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` / `lint:fix` | ESLint (CI runs the non-fixing variant) |
| `npm run test` / `test:e2e` | Unit / end-to-end tests |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a migration |
| `npm run db:deploy` | `prisma migrate deploy` — apply migrations (CI/prod) |
| `npm run db:studio` | Prisma Studio |

### Conventions carried forward

- Every route lives under the `/api` prefix.
- Request DTOs are validated globally (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected rather than silently ignored.
- Environment variables are validated at boot in `backend/src/config/env.validation.ts` — add new vars there, and to `.env.example`.
- `PrismaService` is `@Global()`, so feature modules inject it without importing anything.

### Notes on this machine's toolchain

- Node is 20.11.1, below Prisma 7's floor (20.19+), so Prisma is pinned to `^6`. Bump both `prisma` and `@prisma/client` together after upgrading Node.
- `npm` hit `EACCES` writing to `~/.npm/_cacache` during setup. If you see it, `sudo chown -R $(whoami) ~/.npm` clears it.

---

# Development Modules

Each module below is meant to be built in order, since later modules depend on earlier ones. Within each module: what to build, DB tables touched, API endpoints, UI screens, and a "done when" checklist so you know when to move on.

## MODULE 0 — Project Setup ✅

Goal: Skeleton running end-to-end before any real feature.

- Init backend (NestJS/Django) + frontend (React/Vite) repos
- Set up PostgreSQL + ORM (Prisma/Django ORM), connect both apps
- Set up `.env` config for DB, JWT secret, etc.
- Basic CI (lint + build on push) — optional but recommended early
- Docker Compose for local dev (app + db) — optional

**Done when:** Backend returns a health-check response, frontend can call it, DB connects.

## MODULE 1 — Auth & RBAC Foundation

Goal: Login works, and every future route can be permission-gated.

**Tables:** `users`, `roles`, `permissions`, `role_permissions`

**Backend:**

- User model + password hashing (bcrypt/argon2)
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- JWT strategy (access + refresh token)
- `PermissionGuard` + `@RequirePermission('x')` decorator
- Seed script: create roles (SUPER_ADMIN, DIRECTOR, PRINCIPAL, ADMIN, TEACHER), seed permissions list, seed role_permissions mapping (Director/Principal/Admin → same "Management" set)

**Frontend:**

- Login page
- Auth context/store (store user + permissions array after login)
- Route guard component (`<ProtectedRoute permission="x">`)
- Basic authenticated shell (topbar + empty sidebar)

**Done when:** You can log in as a seeded SUPER_ADMIN and hit a protected `/me` endpoint that returns user + role + permissions.

## MODULE 2 — User Management (Staff Accounts)

Goal: SUPER_ADMIN/ADMIN can create logins for Directors, Principals, Admins, Teachers.

**Tables:** `users` (extended), `roles`

**Backend:**

- `GET/POST/PATCH/DELETE /users` (permission-gated: `user.view/create/edit/delete`)
- Role assignment on user creation
- Prevent non-SUPER_ADMIN from creating/editing SUPER_ADMIN accounts

**Frontend:**

- User list page (table, filter by role)
- Create/Edit user form (name, email, phone, role dropdown)
- Sidebar now becomes dynamic: build it once here, driven by `permissions[]` — every later module just adds an entry to a nav-config file

**Done when:** SUPER_ADMIN can create a Teacher login, that teacher can log in and see only what their permissions allow (even if the sidebar is still mostly empty).

## MODULE 3 — Academic Structure Setup

Goal: Classes/sections/subjects/academic year exist before students/teachers can be assigned to them.

**Tables:** `academic_years`, `classes`, `sections`, `subjects`

**Backend:**

- CRUD for academic year (with `is_current` flag)
- CRUD for classes (tied to academic year)
- CRUD for sections (tied to class)
- CRUD for subjects (tied to class)

**Frontend:**

- Settings → Academic Setup page
- Simple nested UI: Academic Year → Classes → Sections/Subjects (tabs or accordion)

**Done when:** Admin can set up "2026-27" academic year with classes (1–10), sections (A/B), and subjects per class.

## MODULE 4 — Teacher Management

Goal: Full teacher profiles, ready to be assigned to classes.

**Tables:** `teachers` (linked to `users`), `teacher_class_subject`

**Backend:**

- `GET/POST/PATCH/DELETE /teachers` (permission-gated)
- Teacher creation flow: creates a `users` row (role = TEACHER) + `teachers` profile row together
- `POST /teachers/:id/assignments` → assign teacher to class+section+subject

**Frontend:**

- Teacher list page
- Teacher profile form (personal info + qualification + joining date)
- Assignment UI: pick class/section/subject(s) for a teacher

**Done when:** You can create a teacher, log in as them, and confirm they only see their own assigned classes (even though attendance module isn't built yet — just verify the assignment data is queryable and scoped).

## MODULE 5 — Student Management

Goal: Full student records, assigned to class/section.

**Tables:** `students`

**Backend:**

- `GET/POST/PATCH/DELETE /students` (permission-gated)
- Filter students by class/section (needed heavily later for attendance)
- Guardian info fields

**Frontend:**

- Student list page (filter by class/section, search by name/admission no.)
- Student admission form
- Student profile view/edit

**Done when:** Admin can add students to a class/section, teacher (read-only) can see students in their assigned classes only.

## MODULE 6 — Student Attendance

Goal: The core daily workflow — teachers mark attendance for their assigned classes.

**Tables:** `student_attendance` (+ optional `periods`)

**Backend:**

- `POST /attendance/students` — bulk mark for a class/section/date (permission: `attendance.student.mark`, scoped to teacher's `teacher_class_subject` assignments)
- `GET /attendance/students?date=&class_id=&section_id=`
- `PATCH /attendance/students/:id` (permission: `attendance.student.edit`, with same-day restriction for teachers, unrestricted for admins)
- DB unique constraint: `(student_id, date[, period_id])`

**Frontend:**

- "Mark Attendance" page: pick class/section/date → roster loads → fast toggle buttons (Present/Absent/Late/Leave) per student → bulk save
- Attendance history view (calendar or table, filterable)

**Done when:** A teacher can mark attendance for their own class only, admins can view/edit attendance for any class, and duplicate entries are blocked at the DB level.

## MODULE 7 — Teacher Attendance

Goal: Track staff attendance separately from student attendance.

**Tables:** `teacher_attendance`

**Backend:**

- `POST /attendance/teachers` (self-mark or admin-marks-for-teacher)
- `GET /attendance/teachers?date=&teacher_id=`
- Permission split: teacher marks/views own only; admins view/mark all

**Frontend:**

- "My Attendance" widget for teachers (check-in/out or daily status)
- Admin view: staff attendance table, filterable by date/department

**Done when:** Teachers can mark their own attendance, admins can see a full staff attendance sheet for any date.

## MODULE 8 — Dashboards

Goal: Give each role a useful landing page (build after data exists, so dashboards have something to show).

**Backend:**

- Aggregate endpoints: `GET /dashboard/admin-summary`, `GET /dashboard/teacher-summary`
- (Today's attendance %, absentee count, total students/teachers, etc.)

**Frontend:**

- Admin/Director/Principal dashboard: school-wide stats, quick links
- Teacher dashboard: today's classes, quick "mark attendance" shortcut, own attendance status

**Done when:** Logging in as each role shows a relevant, populated dashboard instead of a blank page.

## MODULE 9 — Reports

Goal: Turn raw attendance data into decisions.

**Backend:**

- `GET /reports/attendance-summary?class_id=&from=&to=` — % present per student/class
- `GET /reports/defaulters?threshold=75` — students below attendance %
- `GET /reports/staff-attendance-summary`
- Exclude holidays from % calculations (needs a `holidays` table — add here if not done earlier)

**Frontend:**

- Reports page with filters (date range, class)
- Table + simple chart (e.g. bar chart of attendance % by class)
- Export to CSV/PDF (optional, common ask for school admins)

**Done when:** Admin can pull "students below 75% attendance this month" in one screen.

## MODULE 10 — Audit Log & Admin Tools

Goal: Accountability layer — who changed what.

**Tables:** `audit_logs`

**Backend:**

- Global interceptor/middleware: log every create/update/delete on students, teachers, attendance, roles/permissions
- `GET /audit-logs?entity_type=&user_id=&from=&to=` (SUPER_ADMIN only)

**Frontend:**

- Audit log viewer (SUPER_ADMIN only): filterable table of changes

**Done when:** Editing a past attendance record produces a visible audit trail entry with old/new values.

## MODULE 11 — Notifications (Optional but high-value)

Goal: Proactive alerts, especially absentee notices.

**Backend:**

- Notification service (email/SMS provider integration)
- Trigger: student marked absent → notify guardian (async job/queue recommended)

**Frontend:**

- Announcement creation UI (admin)
- In-app notification bell for staff

**Done when:** Marking a student absent triggers a queued notification job (even if just logged/emailed in dev).

## MODULE 12 — Polish & Hardening

Goal: Production readiness.

- Role/permission management UI (SUPER_ADMIN can edit role_permissions without touching code)
- Input validation everywhere (backend, not just frontend)
- Rate limiting on auth routes
- Error boundaries + loading/empty states across frontend
- Pagination on all list endpoints
- Basic test coverage on permission guards and attendance edge cases (duplicate prevention, scoping)

---

## Suggested Build Order (Summary)

```
0. Project Setup          ✅ done
1. Auth & RBAC            ─┐
2. User Management         │  Foundation — do not skip or reorder
3. Academic Structure     ─┘
4. Teacher Management      ─┐
5. Student Management      ─┘  Core data
6. Student Attendance      ─┐
7. Teacher Attendance      ─┘  Core feature — the reason the app exists
8. Dashboards
9. Reports
10. Audit Log
11. Notifications          (optional, can slot in anytime after Module 6)
12. Polish & Hardening
```

**Rule of thumb:** Modules 0–5 are foundation — build them in exact order since each depends on the last. Modules 6–7 are your MVP finish line — a school could realistically start using the system at that point. Everything after (8–12) improves the experience but isn't blocking.
