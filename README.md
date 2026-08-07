# School ERP

A school management system built module by module. Current state: **Module 10 (Audit Log & Admin Tools) complete**, and the backend has since been migrated from PostgreSQL to MySQL — every create/update/delete on students, teachers, staff accounts and attendance is recorded with before/after values and who did it, viewable in a SUPER_ADMIN-only Audit Log screen. The MVP (Modules 6–7) shipped before this; everything from here improves the experience but isn't blocking.

- **Backend** — NestJS 11 + Prisma 6 + MySQL
- **Frontend** — React 19 + Vite 6 + TypeScript
- **CI** — GitHub Actions (lint + build + e2e for both apps)

---

## Quick start

Prerequisites: Node.js 20+, MySQL 8+ (or Docker).

```bash
git clone <repo> && cd SchoolERP
```

**1. Start MySQL** — either Docker:

```bash
docker compose up -d db
```

…or a local install (Homebrew):

```bash
brew install mysql && brew services start mysql
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

Open <http://localhost:5173> (works on a phone-sized viewport too — the shell, tables and forms are all responsive). You'll land on `/login` — sign in as the seeded SUPER_ADMIN (see below), which lands on a shell showing your role, permissions, and a **Users** section in the sidebar for creating staff logins.

**4. Seed roles, permissions and a SUPER_ADMIN login** (from `backend/`, after migrating):

```bash
npm run db:seed
```

Seeds roles (`SUPER_ADMIN`, `DIRECTOR`, `PRINCIPAL`, `ADMIN`, `TEACHER`), a starter permission set, and logs in as:

```
admin@schoolerp.dev / ChangeMe123!
```

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
│   ├── prisma/
│   │   ├── schema.prisma     users/roles/permissions/role_permissions
│   │   └── seed.ts           roles + permissions + SUPER_ADMIN login
│   ├── src/
│   │   ├── auth/             login/refresh/logout/me, JWT strategy,
│   │   │                     PermissionGuard + @RequirePermission
│   │   ├── users/             staff CRUD, SUPER_ADMIN-account protection
│   │   ├── roles/               GET /roles (role dropdown lookup)
│   │   ├── academic/             academic-years/classes/sections/subjects,
│   │   │                          is_current exclusivity, delete-with-children guard
│   │   ├── teachers/              teacher CRUD (creates user+profile together),
│   │   │                          teacher_class_subject assignments, /teachers/me/assignments,
│   │   │                          class-teacher hand-off (sections.classTeacherId):
│   │   │                          POST/DELETE /teachers/:id/class-teacher(/:sectionId),
│   │   │                          GET /teachers/(:id|me)/class-teacher-of
│   │   ├── students/               student CRUD, class/section consistency check,
│   │   │                           /students/my-classes (teacher read-only scope)
│   │   ├── attendance/             bulk mark (upsert), scoped GET, same-day-restricted
│   │   │                           PATCH — same attendance.student.* permission for
│   │   │                           TEACHER and admins, scoping happens in the service;
│   │   │                           TeacherAttendanceService/-Controller: self-mark or
│   │   │                           admin-marks-any-teacher, same-day-restricted for TEACHER
│   │   ├── dashboard/               GET /dashboard/admin-summary (academic.view-gated),
│   │   │                            GET /dashboard/teacher-summary (self-scoped "me" route)
│   │   ├── holidays/                GET/POST/DELETE /holidays (academic.view/manage) — dates
│   │   │                            excluded from Reports' attendance % calculations
│   │   ├── reports/                 GET /reports/attendance-summary(?class_id=&section_id=&from=&to=),
│   │   │                            /reports/defaulters(?threshold=), /reports/staff-attendance-summary
│   │   │                            — all academic.view-gated, all default to the current UTC month
│   │   ├── audit/                   AuditLogService.record() called from Students/Teachers/Users/
│   │   │                            Attendance services on every create/update/delete; GET /audit-logs
│   │   │                            (SUPER_ADMIN only, via SuperAdminGuard — not permission-based)
│   │   ├── config/           env validation — fails fast on a bad .env
│   │   ├── health/           GET /api/health
│   │   ├── prisma/           global PrismaService (+ ping for health)
│   │   ├── app.module.ts
│   │   └── main.ts           global /api prefix, ValidationPipe, CORS, cookies
│   └── test/                 e2e specs
├── frontend/                 React + Vite
│   └── src/
│       ├── api/               typed fetch client (auto-attaches access token)
│       ├── auth/               AuthProvider, ProtectedRoute, in-memory token store
│       ├── pages/               LoginPage, DashboardHome, Users list/form,
│       │                         AcademicSetupPage (+ academic/NamedItemList),
│       │                         Teachers list/form/assignments, MyClassesPage,
│       │                         Students list/admission form, MyStudentsPage,
│       │                         MarkAttendancePage, AttendanceHistoryPage
│       │                         (+ attendance/useClassSectionScope, AttendanceStatusToggle),
│       │                         MyAttendancePage (teacher self-mark), StaffAttendancePage
│       │                         (admin sheet, filterable by date), dashboard/AdminDashboard,
│       │                         dashboard/TeacherDashboard (DashboardHome picks one by role),
│       │                         ReportsPage (tabbed: summary/defaulters/staff, CSV export,
│       │                         AcademicSetupPage grew a Holidays panel to feed it),
│       │                         AuditLogsPage (SUPER_ADMIN only: filter + expandable before/after)
│       └── shell/                topbar + permission-and-role-driven sidebar
│                                  (nav-config.ts), mobile drawer under 768px
├── .github/workflows/ci.yml
└── docker-compose.yml        MySQL 8
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
| `npm run db:seed` | Seed roles, permissions, role_permissions, and a SUPER_ADMIN login |
| `npm run db:studio` | Prisma Studio |

### Conventions carried forward

- Every route lives under the `/api` prefix.
- Request DTOs are validated globally (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected rather than silently ignored.
- Environment variables are validated at boot in `backend/src/config/env.validation.ts` — add new vars there, and to `.env.example`.
- `PrismaService` is `@Global()`, so feature modules inject it without importing anything.
- Access tokens are short-lived JWTs returned in the login/refresh response body (frontend keeps them in memory only, never localStorage). Refresh tokens are longer-lived JWTs in an `httpOnly` cookie scoped to `/api/auth`, with a bcrypt hash of the current one stored on the `users` row so logout/rotation can revoke it server-side.
- Gate a route with `@UseGuards(JwtAuthGuard, PermissionGuard)` + `@RequirePermission('some.key')` (that order — the JWT guard populates `req.user` first). `SUPER_ADMIN` always passes `PermissionGuard`, seeded rows or not.
- Only a `SUPER_ADMIN` may create, edit, or delete a `SUPER_ADMIN` account, or hand the `SUPER_ADMIN` role to anyone else — enforced in `UsersService`, not just the UI.
- Frontend nav is data-driven: add `{ label, path, permission }` to `frontend/src/shell/navConfig.ts` and `AppShell` shows/hides it automatically based on the signed-in user's `permissions[]`. No per-module sidebar edits needed.
- Restrict-on-delete, not cascade: `Class`/`Section`/`Subject` foreign keys use `onDelete: Restrict`, and `AcademicService` translates the resulting Prisma `P2003` into a friendly 409 ("cannot delete a class that still has sections or subjects") instead of silently wiping child rows.
- Only one `AcademicYear` may have `isCurrent: true`; setting it wraps the unset-others + create/update in a single `$transaction` rather than trusting the client to send consistent data.
- `frontend/src/pages/academic/NamedItemList.tsx` is the shared "named rows with inline add/rename/delete" component behind classes, sections and subjects — reuse it before writing a new list UI for a similarly-shaped resource.
- The app is mobile-first responsive (breakpoint at 768px): the sidebar becomes a slide-in drawer, and `.data-table` collapses into labelled cards. Reuse those two classes for new list/table screens rather than inventing new responsive CSS.
- Global `box-sizing: border-box` is set once in `index.css` — without it, any element with both padding and a flex-computed width silently overflows its container on narrow viewports. Module 4 hit this for real (teacher row actions clipped off-screen on mobile) before the reset was added; don't re-add per-component `box-sizing` overrides to work around a missing reset elsewhere.
- Deleting a `Teacher` deletes their linked `User` (not the other way around) — `Teacher.userId` is `onDelete: Cascade` from `User`, so `TeachersService.remove()` just deletes the `User` row and the profile + assignments disappear with it. There's no independent "teacher without a login" state.
- `navConfig.ts` entries support both `permission` and `roles` — use `roles` for self-service pages with no natural permission key (e.g. a teacher's own "My Classes", visible only to the `TEACHER` role).
- Routes with `Get('literal/path')` and `Get(':param/path')` at the same depth must be registered literal-first (see `TeachersController`: `me/assignments` is declared before `:id/assignments`; `StudentsController`: `my-classes` before `:id`) — Express/Nest match in declaration order, so the param route would otherwise swallow the literal one and 400 on the int parse.
- A student belongs to exactly one class+section (a direct FK, not a join table like teacher assignments) — `StudentsService` requires `sectionId` whenever `classId` changes, so a class move can never leave a student pointing at a section from the old class.
- Teacher-scoped read views (e.g. `GET /students/my-classes`) don't use `@RequirePermission` — a `TEACHER` has no `student.view`, so the route relies on `JwtAuthGuard` alone and resolves scope from the caller's own `Teacher` row (via `TeacherClassSubject`), not from a query param the client could tamper with.
- Module 6 broke that pattern on purpose: `TEACHER` **does** hold `attendance.student.view/mark/edit` (seeded directly onto the role, alongside the Director/Principal/Admin "Management" set) — the same permission gates everyone, and `AttendanceService.isScopedToOwnClasses()` does the actual restriction (assignment check + same-day check) only for `TEACHER`. Pick whichever pattern fits: a brand-new self-service concept usually wants its own unguarded route; a workflow every role already touches (marking attendance) wants one shared permission with server-side scoping.
- Dates that cross a day boundary must be compared in one timezone end-to-end. `AttendanceService`'s same-day check for teachers uses UTC calendar dates (`date.toISOString().slice(0, 10)`, matching how the DB stores `@db.Date` and how a bare `"YYYY-MM-DD"` string parses); the frontend's date pickers default to `todayUtcDate()` (`pages/attendance/todayUtc.ts`) for the same reason. A `todayLocalDate()` version existed briefly and broke for any timezone ahead of UTC (e.g. IST) for the first several hours of each local day — the client and server disagreed on what day it was. Don't reintroduce a local-time default here without also changing the server side to match.
- `frontend/src/pages/attendance/useClassSectionScope.ts` is the shared hook behind both attendance pages' class/section picker — it branches on `academic.view`: admins get the full Year→Class→Section cascade, a `TEACHER` gets a flat list derived from `GET /teachers/me/assignments` (they can't call `GET /academic-years` at all). `MarkAttendancePage`'s roster fetch has the same branch, reusing `GET /students/my-classes` for teachers instead of `GET /students`. Any new attendance-adjacent screen needs the same two branches, not just the picker.
- `TeacherAttendanceService` scopes by *identity*, not class/section: a plain `TEACHER` is always pinned to their own `Teacher` row (via `userId`) regardless of what `teacherId` the request sends, and can only self-mark for today; anyone else (admin) must pass an explicit `teacherId` and is unrestricted on date. Same "one shared permission, service does the scoping" shape as Module 6's `attendance.student.*`, applied to `attendance.teacher.view/mark`.
- `POST /attendance/teachers` doubles as create-or-correct (an upsert on the `(teacherId, date)` unique constraint) — there's no separate PATCH, unlike student attendance's roster-based flow, because a teacher only ever has one row to touch at a time.
- Gate admin-only attendance screens (e.g. `StaffAttendancePage`) on an existing admin-only permission like `teacher.view` rather than inventing a new key — `attendance.teacher.*` is intentionally held by both TEACHER and admins (the permission just gets you past the guard; see above), so it can't be the signal for "is this an admin."
- Any `onDelete: Restrict` foreign key needs its owning service to catch the delete and map Prisma's `P2003` to a friendly `ConflictException`, not just `P2002`/`P2025` — `TeachersService.remove()` was missing this and threw a raw 500 the first time a `Teacher` with a self-marked `TeacherAttendance` row (a real FK relationship that didn't exist before Module 7) was deleted. Fixed in `mapError()`; check any other `remove()` next to a newly-added `Restrict` relation for the same gap.
- **Class (homeroom) teacher, not "any assigned teacher," gates student attendance.** Module 6 originally let *any* teacher with a `TeacherClassSubject` row for a class+section mark its attendance — so a Math-only teacher could mark roll for a section they don't own. Fixed by adding `Section.classTeacherId` (nullable FK to `Teacher`, `onDelete: SetNull`): exactly one class teacher per section at a time, but a teacher may hold it for zero, one, or several sections. `AttendanceService.assertIsClassTeacher()` (renamed from `assertTeacherAssigned`) now checks this field, not "does any assignment row exist." A subject assignment and class-teacher status are independent — removing one doesn't touch the other.
  - Set it from the existing "Add assignment" flow (`TeacherAssignmentsPage`): a checkbox, "Set as class teacher of this section," on `CreateAssignmentDto.isClassTeacher`. It can also be set/cleared without any subject at all — `POST /teachers/:id/class-teacher` `{ sectionId }` and `DELETE /teachers/:id/class-teacher/:sectionId` — since being a homeroom teacher doesn't require teaching a subject there.
  - `StudentsService.findForTeacher` (backs `/students/my-classes` and `MyStudentsPage`) was extended to union `TeacherClassSubject` sections with class-teacher sections, so a class teacher sees their homeroom roster even with zero subject assignments in it. Subject-only visibility (view, not mark) is intentionally still broader than attendance rights — a subject teacher keeps read access to a section's roster without being its class teacher.
  - `useClassSectionScope`'s TEACHER branch now sources the picker from `GET /teachers/me/class-teacher-of`, not `/teachers/me/assignments` — a subject-only teacher no longer sees a class+section in the attendance picker at all, not just a 403 after picking it.
  - **Action needed on real data**: this is a behavior change, not just a bug fix — any teacher who was marking attendance solely because of a subject assignment (no class-teacher flag) will be locked out until an admin explicitly sets them (or someone) as the class teacher of that section via the checkbox or card on their assignments page.
- Dashboard aggregate endpoints follow the same two patterns already established rather than inventing a third: `GET /dashboard/admin-summary` is gated with an existing broad "you're staff, not a bare TEACHER" permission (`academic.view`, same trick as `StaffAttendancePage`'s `teacher.view`) instead of a new `dashboard.*` permission; `GET /dashboard/teacher-summary` is an unguarded "me" route (like `/teachers/me/assignments`) scoped from the caller's own `Teacher` row. `DashboardHome.tsx` picks which dashboard to render the same way `useClassSectionScope` picks a data source: `hasPermission('academic.view')` for admin, else role `=== 'TEACHER'`.
- `DashboardService.getAdminSummary()` scopes student/class/section headline counts to the `AcademicYear` with `isCurrent: true` (falls back to unscoped if none is set) so stale prior-year data doesn't inflate "how big is the school right now" — but teacher counts and today's staff-attendance breakdown are deliberately *not* year-scoped, since `Teacher` isn't tied to an academic year in the schema. Attendance percentages are computed against records actually marked today (`totalMarked`), not total enrolled — an unmarked section reads as "no data yet," not as a wave of absences.
- The teacher dashboard's homeroom section list reuses the identical "which sections is this teacher the class teacher of" data as the Module 6.5 fix (`Section.classTeacherId`) to decide which rows get a "Mark attendance" shortcut and an `attendanceMarkedToday` badge — computed the same way `MarkAttendancePage`'s picker is scoped, so the two screens never disagree about which classes a teacher may act on.
- `ReportsService` reuses the dashboard's exact percentage convention (`present / totalMarked`, rounded, null when nothing's marked) rather than inventing a "% of calendar days in range" definition — a range with gaps (weekends, a day nobody marked) doesn't silently drag every student's score down, and a report and a dashboard card covering the same range never disagree. `getDefaulters()` calls `getAttendanceSummary()` internally and filters the result rather than re-deriving the aggregation.
- Both `/reports/*` and `/holidays` reuse `academic.view`/`academic.manage` rather than adding `reports.*`/`holiday.*` permission keys — same "reuse an existing broad permission" call as the dashboard and staff-attendance screens. No seed.ts changes were needed for Module 9.
- `Holiday` (`holidays` table, unique on `date`) exists purely to be subtracted from attendance-% denominators: `ReportsService` fetches holiday dates in range and passes them to Prisma's `notIn` on the attendance query. Manage them from Academic Setup's new "Holidays" panel (date + name, no edit — delete and re-add), not a separate page, since it's calendar config like years/classes/sections.
- Every `/reports/*` endpoint defaults `from`/`to` to the current UTC calendar month when omitted (`ReportsService.resolveRange()`) — same UTC-not-local-time rule as `todayUtcDate()`, and it's what makes "students below 75% this month" a zero-filter, one-click screen per the Module 9 "done when."
- CSV export on `ReportsPage` is client-side (`components/csv.ts`, a `Blob` + anchor-download) rather than a backend endpoint — the data's already loaded as JSON for the on-screen table, so exporting it is just a client-side reshape. PDF export was skipped (marked optional in the spec); revisit only if actually requested.
- Module 10 logs from the **service layer**, not a global interceptor as the spec first suggests — a generic HTTP-layer interceptor can't cleanly tell a real create from an upsert-as-correction (`TeacherAttendanceService.mark()`, `POST /attendance/teachers`), and breaks entirely on bulk endpoints that mutate many rows in one request (`AttendanceService.markBulk()`, `POST /attendance/students`; `StudentsBulkImportService.bulkImport()`). Each mutating service method already computes exactly what changed, so it calls `AuditLogService.record()` directly — one line, no fragile response-shape inference. Most controllers already threaded an `actor`/`@CurrentUser()` through (Users, Attendance, TeacherAttendance); `Students` and `Teachers` needed a new optional `actorId` parameter added to `create`/`update`/`remove` (and `Teachers`' assignment methods) to attribute the log entry — a small, mechanical, low-risk change since nothing about the existing business logic moved.
- `AuditLogService.record()` never throws — a failed audit write is logged server-side (`Logger.error`) and swallowed, not propagated, so a broken `audit_logs` table (or its own transient DB hiccup) can never block a legitimate mutation that already succeeded. Accountability is important, but it must never become a single point of failure for the thing it's watching.
- Bulk operations get one audit row **per affected entity**, not one row for the whole batch: `markBulk()` fetches the existing `(studentId, date)` rows before the transaction so each resulting row can be correctly tagged CREATE or UPDATE, and `StudentsBulkImportService` gets per-student audit logging for free because it already calls `StudentsService.create()` per row — no separate bulk-import-specific logging code was needed.
- `AuditLogService` stores raw Prisma rows as `oldValues`/`newValues` (flat `classId`/`sectionId`, not the nested `{id,name}` shape the list/detail endpoints return) — a forensic trail favors exact column values over the friendlier shape a UI wants. The one exception: `UsersService` redacts `passwordHash`/`hashedRefreshToken` before logging a `User` row — a bcrypt hash has no forensic value and shouldn't be duplicated into a second table even hashed.
- `GET /audit-logs` is gated by a new `SuperAdminGuard` (checks `roleName === 'SUPER_ADMIN'` directly), not `@RequirePermission` — Director/Principal/Admin hold every key in `PERMISSIONS` via the existing "Management" seed, so no permission string could be SUPER_ADMIN-exclusive without restructuring that seed. This is the first route in the app gated by role instead of permission; `ProtectedRoute` grew a matching optional `roles?: string[]` prop (alongside the existing `permission?`) so the frontend route gets the same restriction, mirroring how `navConfig.ts` entries already support both `permission` and `roles` for nav visibility.
- **DB engine: PostgreSQL → MySQL.** `schema.prisma`'s `datasource` provider is `mysql`; `docker-compose.yml` and CI now run `mysql:8` instead of `postgres:16-alpine`. The application code was barely coupled to Postgres — the only real casualty was `mode: 'insensitive'` on the `contains` filters in `StudentsService.findAll()`/`UsersService.findAll()` (a Postgres-only Prisma option; MySQL's default collation, `utf8mb4_*_ci`, is already case-insensitive, so the filters were simply dropped, not replaced). Everything else — `Json?` fields on `AuditLog`, the `AttendanceStatus`/`AuditAction` enums, `@db.Date`, cascades/restricts — is supported identically by Prisma's MySQL connector, no schema changes needed. The old Postgres migration history doesn't translate (different SQL dialect), so `backend/prisma/migrations/` was rebuilt from scratch as a single `init` baseline against MySQL; the original Postgres migrations were moved (not deleted) to `backend/prisma/migrations_postgres_backup/` for reference — safe to remove once nobody needs to diff against pre-migration schema history. Since this was a dev database with only seeded/demo data, no data export/import was needed — just a fresh migrate + reseed.

### Notes on this machine's toolchain

- Node is 20.11.1, below Prisma 7's floor (20.19+), so Prisma is pinned to `^6`. Bump both `prisma` and `@prisma/client` together after upgrading Node.
- `npm` hit `EACCES` writing to `~/.npm/_cacache` during setup. If you see it, `sudo chown -R $(whoami) ~/.npm` clears it.
- Local MySQL runs via `docker compose up -d db` (image `mysql:8`, matching CI). The `schoolerp` user needs `GRANT ALL PRIVILEGES` (not just on `school_erp`) because `prisma migrate dev` creates a throwaway shadow database on every run — a scoped grant on just `school_erp` fails with Prisma error `P3014`.

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

## MODULE 1 — Auth & RBAC Foundation ✅

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

## MODULE 2 — User Management (Staff Accounts) ✅

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

## MODULE 3 — Academic Structure Setup ✅

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

## MODULE 4 — Teacher Management ✅

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

## MODULE 5 — Student Management ✅

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

## MODULE 6 — Student Attendance ✅

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

## MODULE 7 — Teacher Attendance ✅

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

## MODULE 8 — Dashboards ✅

Goal: Give each role a useful landing page (build after data exists, so dashboards have something to show).

**Backend:**

- Aggregate endpoints: `GET /dashboard/admin-summary`, `GET /dashboard/teacher-summary`
- (Today's attendance %, absentee count, total students/teachers, etc.)

**Frontend:**

- Admin/Director/Principal dashboard: school-wide stats, quick links
- Teacher dashboard: today's classes, quick "mark attendance" shortcut, own attendance status

**Done when:** Logging in as each role shows a relevant, populated dashboard instead of a blank page.

## MODULE 9 — Reports ✅

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

## MODULE 10 — Audit Log & Admin Tools ✅

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
1. Auth & RBAC            ✅ done ─┐
2. User Management        ✅ done │  Foundation — do not skip or reorder
3. Academic Structure     ✅ done ─┘
4. Teacher Management     ✅ done ─┐
5. Student Management     ✅ done ─┘  Core data
6. Student Attendance     ✅ done ─┐
7. Teacher Attendance     ✅ done ─┘  Core feature — the reason the app exists
8. Dashboards               ✅ done
9. Reports                  ✅ done
10. Audit Log               ✅ done
11. Notifications          (optional, can slot in anytime after Module 6)
12. Polish & Hardening
```

**Rule of thumb:** Modules 0–5 are foundation — build them in exact order since each depends on the last. Modules 6–7 are your MVP finish line — a school could realistically start using the system at that point. Everything after (8–12) improves the experience but isn't blocking.
