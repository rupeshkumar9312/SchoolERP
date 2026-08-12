# School ERP

A school management system built module by module. Current state: **Module 10 (Audit Log & Admin Tools) complete**, the backend has since been migrated from PostgreSQL to MySQL, **Module 1.5 (Password Management)** forces a change-password screen on every login's first use and lets a SUPER_ADMIN reset anyone's password, **Module 10.5 (Class Assignments)** adds teacher-owned homework with strict view/edit/delete ownership, a staff-recorded submission checklist per student, file attachments, and both bulk (.xlsx) and recurring-weekly creation, **Module 10.6 (Student Portal)** gives every newly-admitted student their own read-only login (auto-provisioned at admission time) to see their own attendance and their own class's assignments, and **Module 10.7 (Announcements)** lets admin-tier staff post notices targeted at students, teachers, and/or admins — every create/update/delete on students, teachers, staff accounts, attendance, assignments and announcements is recorded with before/after values and who did it, viewable in a SUPER_ADMIN-only Audit Log screen. The MVP (Modules 6–7) shipped before this; everything from here improves the experience but isn't blocking.

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
│   │   │                     PermissionGuard + @RequirePermission, SuperAdminGuard;
│   │   │                     POST /auth/change-password (own account, any role)
│   │   ├── users/             staff CRUD, SUPER_ADMIN-account protection,
│   │   │                     POST /users/:id/reset-password (SuperAdminGuard)
│   │   ├── common/             generate-temp-password.ts — shared by student
│   │   │                       admission and admin password resets
│   │   ├── roles/               GET /roles (role dropdown lookup)
│   │   ├── academic/             academic-years/classes/sections/subjects,
│   │   │                          is_current exclusivity, delete-with-children guard
│   │   ├── teachers/              teacher CRUD (creates user+profile together),
│   │   │                          teacher_class_subject assignments, /teachers/me/assignments,
│   │   │                          class-teacher hand-off (sections.classTeacherId):
│   │   │                          POST/DELETE /teachers/:id/class-teacher(/:sectionId),
│   │   │                          GET /teachers/(:id|me)/class-teacher-of
│   │   ├── students/               student CRUD, class/section consistency check,
│   │   │                           /students/my-classes (teacher read-only scope);
│   │   │                           create() also provisions a STUDENT login (Module 10.6),
│   │   │                           remove() deletes via the linked User row when one exists
│   │   ├── attendance/             bulk mark (upsert), scoped GET, same-day-restricted
│   │   │                           PATCH — same attendance.student.* permission for
│   │   │                           TEACHER and admins, scoping happens in the service;
│   │   │                           TeacherAttendanceService/-Controller: self-mark or
│   │   │                           admin-marks-any-teacher, same-day-restricted for TEACHER;
│   │   │                           GET /attendance/students/me — unguarded "me" route for STUDENT
│   │   ├── dashboard/               GET /dashboard/admin-summary (academic.view-gated),
│   │   │                            GET /dashboard/teacher-summary, GET /dashboard/student-summary
│   │   │                            (both self-scoped "me" routes, no permission required)
│   │   ├── holidays/                GET/POST/DELETE /holidays (academic.view/manage) — dates
│   │   │                            excluded from Reports' attendance % calculations
│   │   ├── reports/                 GET /reports/attendance-summary(?class_id=&section_id=&from=&to=),
│   │   │                            /reports/defaulters(?threshold=), /reports/staff-attendance-summary
│   │   │                            — all academic.view-gated, all default to the current UTC month
│   │   ├── audit/                   AuditLogService.record() called from Students/Teachers/Users/
│   │   │                            Attendance/Assignments services on every create/update/delete;
│   │   │                            GET /audit-logs (SUPER_ADMIN only, via SuperAdminGuard — not
│   │   │                            permission-based)
│   │   ├── assignments/             GET/POST/PATCH/DELETE /assignments — teacher-owned homework;
│   │   │                            a TEACHER sees/edits only their own, admin roles see all but
│   │   │                            can't mutate (enforced in the service, not the permission guard);
│   │   │                            + submissions (assignment_submissions), file attachments
│   │   │                            (backend/uploads/assignments/, git-ignored), bulk-import
│   │   │                            (assignments-bulk-import.service.ts) and recurring-weekly create;
│   │   │                            GET /assignments/me — unguarded "me" route for STUDENT, their
│   │   │                            own class+section's homework; GET :id and :id/attachment carry
│   │   │                            no @RequirePermission either — assertMayView() alone decides
│   │   │                            (teacher-owns-only / student-own-class-only / admin unrestricted)
│   │   ├── announcements/           GET /announcements(/:id) — unguarded, scoped by audience
│   │   │                            group (admin-tier sees all, TEACHER/STUDENT see their own);
│   │   │                            POST/PATCH/DELETE gated by announcement.create/edit/delete
│   │   │                            (Management set only — a TEACHER can view but never post)
│   │   ├── config/           env validation — fails fast on a bad .env
│   │   ├── health/           GET /api/health
│   │   ├── prisma/           global PrismaService (+ ping for health)
│   │   ├── app.module.ts
│   │   └── main.ts           global /api prefix, ValidationPipe, CORS, cookies
│   └── test/                 e2e specs
├── frontend/                 React + Vite
│   └── src/
│       ├── api/               typed fetch client (auto-attaches access token)
│       ├── auth/               AuthProvider (login/logout/changePassword), ProtectedRoute
│       │                       (redirects to /change-password while mustChangePassword),
│       │                       in-memory token store
│       ├── components/          ChangePasswordForm — shared by ChangePasswordPage (forced)
│       │                        and SettingsPage (voluntary)
│       ├── pages/               LoginPage (+ Forgot-password contact-admin popup),
│       │                         ChangePasswordPage, SettingsPage, DashboardHome, Users list/form,
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
│       │                         AuditLogsPage (SUPER_ADMIN only: filter + expandable before/after),
│       │                         AssignmentsPage (create/edit/delete own for a TEACHER,
│       │                         read-only school-wide table with filters for admin roles;
│       │                         + submission checklist, attachment upload/download,
│       │                         recurring-weekly field), AssignmentsBulkImportPage,
│       │                         dashboard/StudentDashboard (today's attendance, this month's %,
│       │                         upcoming assignments), StudentAttendancePage (read-only history),
│       │                         StudentAssignmentsPage (read-only, own class, attachment download,
│       │                         own submitted/not-submitted badge) — all STUDENT-only,
│       │                         AnnouncementsListPage (every role, admin-tier gets manage
│       │                         actions), AnnouncementFormPage (audience checkboxes)
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
- **Module 10.5 descopes "students can view their own class's assignments."** There is no student login in this app — `Student` is a data record (name, class, guardian info), not a `User` with an account; the five seeded roles are all staff roles. Building real student-facing authorization would mean adding a `STUDENT` role, linking `Student` to `User`, and a student login/portal — a materially larger feature than "assignments," and out of scope here by explicit user decision. Assignments therefore only has three audiences: the owning `TEACHER`, other admin-tier roles (read-only), and nobody else. **Update:** built as Module 10.6 (see below).
- **Assignments are admin-visible but admin-immutable, on purpose.** `assignment.create`/`edit`/`delete` are real permission keys, and Director/Principal/Admin hold them too via the "Management" catch-all (`MANAGEMENT_PERMISSION_KEYS = PERMISSIONS.map(p => p.key)`) — the same structural fact that forced `SuperAdminGuard` to exist for Module 10 means no permission string can ever be "TEACHER-exclusive" either. So `AssignmentsService.create/update/remove()` each explicitly check `actor.roleName !== 'TEACHER'` and throw `ForbiddenException` regardless of what the permission guard already allowed — admins pass the guard (they hold the key) but are blocked in the service, mirroring Module 6's "one shared permission, the service does the actual restriction" pattern, just inverted (blocking a superset instead of narrowing one role's view).
- **Homework ownership reuses `TeacherClassSubject`, not a new concept.** A teacher may only create an assignment for a class+section+subject they already hold a `TeacherClassSubject` row for (`AssignmentsService.assertAssignedToTeach()`) — the same "who teaches what" relationship Module 4/6 already established, not a parallel permission system. `UpdateAssignmentDto` deliberately excludes `classId`/`sectionId`/`subjectId`/`teacherId` — editing is content-only (title/description/due date); moving an assignment to a different class is delete-and-recreate, so the ownership check never needs to be re-run mid-edit.
- **Naming collision, avoided on purpose:** `frontend/src/api/teachers.ts` already exports an `Assignment` type and `listAssignments`/`createAssignment`/`deleteAssignment` functions for `TeacherClassSubject` ("who teaches what"). Module 10.5's homework feature is a different concept ("what homework was set") that the user also calls "assignments," so its frontend API lives in a new `api/homework.ts` exporting `HomeworkAssignment`/`listHomeworkAssignments`/etc. — distinct names so a page needing both APIs (as `AssignmentsPage.tsx` does, to source a teacher's class/section/subject options) never has an import collision. The backend has no such collision risk (separate service files, never imported together), so `assignments/assignments.service.ts` uses the natural `AssignmentView`/`CreateAssignmentDto` names.
- **Submission tracking is staff-recorded, on purpose.** Same reasoning as the Module 10.5 student-portal descope above: there's no student login, so `AssignmentSubmission` rows are written by the owning teacher (`PATCH /assignments/:id/submissions/:studentId`), the same trust model as `StudentAttendance`. A row is only materialized in the DB once a teacher actually touches it — `listSubmissions()` computes the full roster by joining `Student` (by class+section) against whatever `AssignmentSubmission` rows exist, defaulting anyone without one to "not submitted," rather than pre-creating N rows at assignment-creation time for classes that may never get checked.
- **Attachments are served through the controller, never a static mount.** `express.static` (or Nest's `ServeStaticModule`) would have been simpler, but it bypasses `JwtAuthGuard`/`PermissionGuard` entirely — anyone with a guessed or leaked URL could download a homework file. `GET /assignments/:id/attachment` re-runs the exact same `assertMayView` ownership check as the assignment itself, so file access always has the same authorization as the assignment record does. `attachmentPath` (the real disk path) is never included in any JSON response — only `attachmentFileName`/`attachmentMimeType`/`attachmentSize`.
- **Recurring assignments are materialized eagerly, not scheduled.** There's no job queue or cron anywhere in this codebase, so `repeatWeeklyUntil` creates every occurrence immediately in one `$transaction` (capped at 52) rather than "an assignment that creates its future selves later." All occurrences share a generated `seriesId` purely for the UI's "weekly" badge — there's no series-level edit/delete; each occurrence is independent once created (deleting one doesn't touch its siblings).
- **Bulk import gets ownership checks for free by reusing `AssignmentsService.create()`** per row, exactly like `StudentsBulkImportService` reuses `StudentsService.create()` in Module 8 — a row for a class/section/subject the uploading teacher doesn't teach fails with the same `ForbiddenException` message a manual create would, surfaced as a per-row error in the results table rather than crashing the whole import.
- **DB engine: PostgreSQL → MySQL.** `schema.prisma`'s `datasource` provider is `mysql`; `docker-compose.yml` and CI now run `mysql:8` instead of `postgres:16-alpine`. The application code was barely coupled to Postgres — the only real casualty was `mode: 'insensitive'` on the `contains` filters in `StudentsService.findAll()`/`UsersService.findAll()` (a Postgres-only Prisma option; MySQL's default collation, `utf8mb4_*_ci`, is already case-insensitive, so the filters were simply dropped, not replaced). Everything else — `Json?` fields on `AuditLog`, the `AttendanceStatus`/`AuditAction` enums, `@db.Date`, cascades/restricts — is supported identically by Prisma's MySQL connector, no schema changes needed. The old Postgres migration history doesn't translate (different SQL dialect), so `backend/prisma/migrations/` was rebuilt from scratch as a single `init` baseline against MySQL; the original Postgres migrations were moved (not deleted) to `backend/prisma/migrations_postgres_backup/` for reference — safe to remove once nobody needs to diff against pre-migration schema history. Since this was a dev database with only seeded/demo data, no data export/import was needed — just a fresh migrate + reseed.

### Notes on this machine's toolchain

- Node is 20.11.1, below Prisma 7's floor (20.19+), so Prisma is pinned to `^6`. Bump both `prisma` and `@prisma/client` together after upgrading Node.
- `npm` hit `EACCES` writing to `~/.npm/_cacache` during setup. If you see it, `sudo chown -R $(whoami) ~/.npm` clears it.
- Local MySQL runs via `docker compose up -d db` (image `mysql:8`, matching CI). The `schoolerp` user needs `GRANT ALL PRIVILEGES` (not just on `school_erp`) because `prisma migrate dev` creates a throwaway shadow database on every run — a scoped grant on just `school_erp` fails with Prisma error `P3014`.
- `backend/tsconfig.json`'s `outDir` is `./dist-out`, not the conventional `./dist` — on this machine, `backend/dist/`, `backend/build/`, and `backend/compiled/` (three separate redirects, each poisoned in turn) all ended up owned by `root`. **Root cause, found via `ps aux`**: `sudo npm run start` / `sudo npm run dev` processes for this exact project, left running in other terminal tabs — not a one-off stray process. Nest's `deleteOutDir: true` can't clear a root-owned directory without a password this environment doesn't have. If `npm run build`/`start:dev` throws `EACCES: permission denied, rmdir '.../<outDir>/...'` again: first check `ps aux | grep sudo` for a lingering `sudo npm run` and stop it (that fixes the cause); if you just need to get building again right now, repoint `outDir` (in both `tsconfig.json` and `tsconfig.build.json`'s `exclude`) and `start:prod` (in `package.json`) at a fresh, never-used folder name instead. Don't run this project's `npm run start`/`npm run dev`/`npm run build` under `sudo` — nothing here needs elevated privileges, and it's the thing causing the problem.
- Against a remote/shared MySQL host that won't grant shadow-database privileges (`prisma migrate dev` fails with `P3014` the same way a mis-scoped grant does locally), generate migration SQL without a shadow database via `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, hand-place the output under `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy` (which never needs a shadow database, only `migrate dev` does). Used for the Module 10.6 `student_portal_login` migration.

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

## MODULE 1.5 — Password Management ✅

Goal: Every login this app ever creates starts from a password the user didn't pick (seeded, admin-set, or generated) — force a change on first login, let anyone change their own password later, and give SUPER_ADMIN a way to reset a forgotten one. Not part of the original module list, added after Module 10.6 once the app had multiple kinds of admin-provisioned logins (staff, teacher, student) all sharing this same gap.

**Tables:** `users` (extended: `mustChangePassword Boolean @default(true)`)

**Backend:**

- Migration `add_must_change_password`: the `@default(true)` applies to every existing row too, not just new ones — including the seeded SUPER_ADMIN, so the documented `ChangeMe123!` credential now also forces a change on its very next login. That's intentional, not an oversight: "any type of user" per the request that drove this module, and re-running `db:seed` never resets it back (the upsert's `update: {}` doesn't touch it).
- `POST /auth/change-password` (`ChangePasswordDto { currentPassword, newPassword }`, any authenticated user, own account only) — verifies `currentPassword` against the stored hash, rejects a `newPassword` identical to the current one, hashes and saves the new one, flips `mustChangePassword` to `false`. **One endpoint serves both flows** — the forced first-login change and a later voluntary change from Settings — since the backend has no reason to care which UI screen called it; only the frontend's messaging differs.
- `AuthenticatedUserView` (and therefore the login/refresh/`/me`/change-password response body) gained `mustChangePassword: boolean`. Deliberately **not** added to the JWT payload — access tokens are short-lived and stateless already, and baking a mutable flag into them would mean a stale token lies about it until it expires; the frontend instead re-reads this field fresh on every auth-related response.
- `POST /users/:id/reset-password` (`SuperAdminGuard`, not `@RequirePermission('user.edit')`) — generates a temp password via a new shared `generateTempPassword()` util (`backend/src/common/generate-temp-password.ts`, extracted from Module 10.6's student-admission flow so both call sites share one implementation), sets `mustChangePassword: true`, and clears `hashedRefreshToken` so any session the target user already has open is killed immediately rather than continuing to work until its access token naturally expires. Gated by role, not permission, for the same reason `GET /audit-logs` is: Director/Principal/Admin hold `user.edit` too via the "Management" set, but must not be able to reset anyone's password — only a `SUPER_ADMIN` may.

**Frontend:**

- `ChangePasswordForm.tsx` — the one shared form (current/new/confirm password), reused by two different pages rather than duplicated:
  - `ChangePasswordPage.tsx` (`/change-password`, standalone route outside `AppShell` like `LoginPage`) — the forced screen, reached only while `mustChangePassword` is `true`. Includes a "Log out instead" escape hatch for someone who got here by mistake or forgot their temp password.
  - `SettingsPage.tsx` (`/settings`, inside `AppShell`, no permission — every authenticated role sees it in the nav) — the voluntary later change, shows a toast on success instead of redirecting.
- `ProtectedRoute.tsx` grew one more check, ahead of the existing permission/role ones: if `state.user.mustChangePassword` and the current path isn't `/change-password`, redirect there. Because the top-level `<ProtectedRoute>` wraps `AppShell` (and therefore every nested route), this one change forces the redirect from anywhere in the app without touching individual pages.
- `LoginPage.tsx` — a "Forgot password?" link opens a small dismissible popup ("contact your school administrator"). No backend route behind it; email/reset-token flows were explicitly out of scope for this module.
- `UsersListPage.tsx` — a "Reset password" row action, visible only when the signed-in user's `role.name === 'SUPER_ADMIN'` (not `hasPermission('user.edit')`, which Director/Principal/Admin also hold) — mirrors how `AuditLogsPage`'s nav entry is `roles: ['SUPER_ADMIN']` rather than a permission check. The generated temp password is shown once, inline, in a dismissible card — same one-time-reveal pattern as Module 10.6's student-admission credentials card.

**Decisions locked in for this module:**

- No email/SMS reset flow — "contact the administrator" is the entire forgot-password story for v1. Revisit if the school ever needs self-service reset without an admin in the loop.
- Server-side enforcement stops at the two password endpoints themselves (`change-password` checks the current password; `reset-password` is `SuperAdminGuard`-gated). `mustChangePassword` is **not** enforced as a global backend guard blocking every other route — a user who bypasses the frontend redirect (e.g. by calling the API directly) can still use the app normally until they change it. This was a deliberate scope call, not an oversight: enforcing it globally would mean touching every controller's guard chain in the app for a purely defense-in-depth gain, when the real target audience (school staff and students clicking through the actual UI) is already fully covered by the frontend redirect.

**Done when:** A brand-new login (seeded, staff, teacher, or student) is forced through `/change-password` before it can reach anything else; the same account can voluntarily change its password again later from Settings; a non-SUPER_ADMIN gets 403 trying to reset anyone else's password; and a SUPER_ADMIN-issued reset immediately invalidates the target's existing session and forces them through the change screen again on their next login.

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

## MODULE 10.5 — Class Assignments ✅

Goal: Teachers can set homework for the classes they teach, with strict ownership — not part of the original module list, added after Module 10.

**Tables:** `assignments`, `assignment_submissions`

**Backend:**

- `POST /assignments` — a TEACHER only, for a class+section+subject they hold a `TeacherClassSubject` row for
- `GET /assignments` — a TEACHER sees only their own; DIRECTOR/PRINCIPAL/ADMIN/SUPER_ADMIN see every assignment school-wide (optionally filtered by `classId`/`sectionId`/`subjectId`/`teacherId`)
- `GET /assignments/:id`, `PATCH /assignments/:id`, `DELETE /assignments/:id` — only the owning teacher; not even an admin
- Every create/update/delete logs to the Module 10 audit trail (`entityType: 'Assignment'`)

**Frontend:**

- `/assignments` page: a TEACHER gets a "new assignment" form (class/section/subject limited to what they teach) plus an editable list of their own homework; an admin-tier viewer gets a read-only, filterable, school-wide table with no create/edit/delete controls

**Done when:** A teacher can create, edit and delete homework for their own class; a different teacher or an admin cannot edit or delete it, and every mutation shows up in the Audit Log with the correct actor.

### 10.5a — Submission tracking ✅

Goal: Know who has and hasn't turned in a given assignment, without a student login.

- `assignment_submissions` (`assignmentId` + `studentId` unique) — a checklist row per student in the assignment's class+section, holding `submitted`, `submittedAt`, and free-text `remarks`
- `GET /assignments/:id/submissions` — full class roster with each student's current status (rows that don't exist yet default to "not submitted," not fabricated in the DB until first touched); viewable by the owning teacher or any admin-tier role
- `PATCH /assignments/:id/submissions/:studentId` — only the owning teacher; upserts the row and logs to the audit trail (`entityType: 'AssignmentSubmission'`)
- `AssignmentView` carries `submittedCount`/`totalStudents` so the list view shows an "X/Y" badge without a second round trip per row
- Frontend: an expandable row under each assignment (same `Fragment`-based expand pattern as `AuditLogsPage`) with a checkbox per student for the teacher, a read-only "Submitted"/"Not submitted" badge for admins

**Done when:** A teacher can check off which students submitted a given assignment, an admin can see the same list read-only, and the X/Y badge on the assignments table updates immediately.

### 10.5b — File attachments ✅

Goal: A teacher can attach a worksheet to an assignment.

- `POST /assignments/:id/attachment` (multipart, owning teacher only), `DELETE /assignments/:id/attachment`, `GET /assignments/:id/attachment` (download, owning teacher or admin-tier)
- Stored on local disk under `backend/uploads/assignments/` (git-ignored), not a static-served path — every download goes through the controller so the same view-authorization as the assignment itself applies; a static mount would have bypassed auth entirely
- 10MB cap, allow-listed MIME types (PDF, Word, Excel, PowerPoint, PNG, JPEG)
- `Assignment.attachmentPath` is never sent to the client — only `attachmentFileName`/`attachmentMimeType`/`attachmentSize` via the `attachment` field on `AssignmentView`

**Done when:** A teacher can upload, download and remove a file on their own assignment; a different teacher gets 403 on upload/remove, an admin can download but not upload/remove.

### 10.5c — Bulk import & recurring creation ✅

Goal: Set many assignments at once, two different ways.

- **Bulk import** (`POST /assignments/bulk-import`, `GET /assignments/bulk-import/template`) — an `.xlsx` upload (Title/Description/Class/Section/Subject/Due Date columns), mirroring Module 8's `StudentsBulkImportService` exactly: resolve Class/Section/Subject by name against the current academic year, then call `AssignmentsService.create()` per row. Reusing `create()` means every row gets the same role check, the same "assigned to teach this class/section/subject" check, and the same audit logging as a single manual creation, for free — no separate authorization path to keep in sync.
- **Recurring weekly** — `CreateAssignmentDto.repeatWeeklyUntil` (optional). When set, `AssignmentsService` materializes one row per week from `dueDate` up to and including that date inside a single `$transaction`, all sharing a generated `seriesId`, capped at 52 occurrences to stop a mistyped far-future date from generating years of rows. There's no scheduler anywhere in this app, so recurrence is eager (every row exists immediately), not a cron job creating them week by week.
- The create endpoint still returns a single `AssignmentView` (the first occurrence) for backward compatibility with the plain one-off create response shape; the frontend re-fetches the full list after a recurring create instead of trying to guess the others.

**Done when:** An `.xlsx` with a mix of valid and invalid rows produces the right success/failure counts and a downloadable failed-rows file; a single "repeat weekly until" creation produces the correct number of dated rows, all linked by `seriesId`.

## MODULE 10.6 — Student Portal ✅

Goal: Give students their own login so they can see their own attendance and assignments — the gap explicitly descoped at Module 10.5 (see the note above). Not part of the original module list, added after 10.5c for the same reason 10.5 itself was: a real need that came up after Module 10 shipped.

**Tables:** `students` (extended: `userId Int? @unique` FK → `users`, `onDelete: Cascade`)

**Backend:**

- Migration `student_portal_login`: `Student.userId Int? @unique` + `User.student Student?` inverse relation, same 1:1 shape and cascade direction as `Teacher.userId` — deleting the `User` row cascades to delete the `Student` row, so `StudentsService.remove()` deletes via the linked `User` (when `userId` is set) instead of the `Student` row directly, exactly mirroring `TeachersService.remove()`.
- Seed: `STUDENT` added to `ROLE_NAMES`. No permission keys are seeded for it — every portal route below is an unguarded "me" route, not `@RequirePermission`-gated, so a `STUDENT` never needs to hold a permission key at all.
- `StudentsService.create()` provisions a `User` (role `STUDENT`) alongside the `Student` row in one `$transaction`, at admission time — same "user + profile together" flow as `TeachersService.create()`, done as two scalar-FK creates in a transaction (not a single nested `student.create({ data: { user: { create } } })`) because mixing Prisma's nested-relation write style with the existing scalar `classId`/`sectionId` fields on the same call isn't allowed by its generated types.
  - **Login email is synthetic**, derived from the (already-unique) admission number: `{admissionNo}@student.schoolerp.local`. Students have no email of their own on file (only a guardian's), and this avoids asking an admin to invent one at admission time.
  - **Password is generated and returned once**, in the create response's `login: { email, temporaryPassword }` field — never stored in plaintext or retrievable again. The admin copies it immediately and hands it to the student/guardian.
  - `StudentView` gained a `hasLogin: boolean` field (`userId !== null`) — students admitted before this module keep working with no login; nothing retroactively provisions one.
- New self-scoped "me" routes — unguarded by `@RequirePermission`, resolved from the caller's own `Student` row via `req.user.id`, never from a client-supplied `studentId` (same identity-pinning convention as `TeacherAttendanceService`):
  - `GET /attendance/students/me` — full history, most recent first (a student has no date/class/section picker, unlike the admin/teacher list route)
  - `GET /assignments/me` — the caller's own class+section's homework, each row's `submitted` reflecting only *their own* status (a narrower `StudentAssignmentView`, not the teacher-facing `submittedCount`/`totalStudents` aggregate)
  - `GET /dashboard/student-summary` — today's attendance, this month's present/%, and up to 5 upcoming assignments
- **`AssignmentsService.assertMayView()` grew a `STUDENT` branch** (own class+section only, `ForbiddenException` otherwise) — a real authorization gap that adding the role opened up, not a cosmetic addition: before this, the method's shape was "restrict `TEACHER` to their own, allow everyone else" which would have let a `STUDENT` view or download *any* assignment school-wide, not just their own class's. To let a `STUDENT` reach it at all, `GET /assignments/:id` and `GET /assignments/:id/attachment` had their `@RequirePermission('assignment.view')` decorator removed entirely — `assertMayView()` inside the service is now the sole authorization for those two routes (teacher-owns-only / student-own-class-only / admin-unrestricted), since a blanket permission gate can't express "own class" scoping and a `STUDENT` holds no permissions to gate on anyway. `assignment.create/edit/delete` and the plain `GET /assignments` list are untouched and still permission-gated — a `STUDENT` can't reach them.
- **`listSubmissions()` explicitly forbids `STUDENT`** — a classmate's submission status is that classmate's data, not the caller's own, and isn't exposed via `/assignments/me` either. This was a deliberate call, not an oversight: nothing in the spec asked for a student-visible submissions roster, and showing one would leak every classmate's status to every student.
- `AuthService.getMe()` (and the login/refresh response) returns a `student: { id, admissionNo, class, section }` field when the caller's role is `STUDENT`, the same way it already resolves role-specific extras — kept intentionally minimal (just enough for the shell to show "Class 6 - A" without an extra round trip).

**Frontend:**

- `dashboard/StudentDashboard.tsx`, modeled on `TeacherDashboard.tsx`'s loading/error/skeleton card pattern (today's status, this month's % with the same progress-bar markup as `AttendanceBreakdown`, upcoming assignments table); `DashboardHome.tsx` grew a `role === 'STUDENT'` branch alongside the existing `TEACHER` one.
- `StudentAttendancePage.tsx` / `StudentAssignmentsPage.tsx` — read-only, following the existing `MyClassesPage` self-service pattern (skeleton → empty state → table). The assignments table reuses `downloadHomeworkAttachment`/`triggerBlobDownload` from the existing homework API unchanged, since the backend route is the same one admins/teachers use — only the server-side scoping differs.
- `navConfig.ts` gained two `roles: ['STUDENT']` entries (`/student/attendance`, `/student/assignments`), same pattern as `TEACHER`'s "My Classes"/"My Attendance"; both routes wrapped in `<ProtectedRoute roles={['STUDENT']}>` in `App.tsx`.
- `StudentFormPage.tsx`: after a successful admission (create, not edit), the form is replaced by a one-time confirmation card showing the generated login email and temporary password with a "Done" button — the password can't be retrieved again once the admin navigates away, so it's surfaced immediately rather than folded into the regular success flow.

**Decisions locked in for this module:**

- Students log in directly — no separate `Guardian`/`Parent` entity or role. The same credentials can be shared with a parent manually; `Student.guardianName/Phone/Email` stay flat fields, unchanged.
- Login accounts are auto-created at admission time, not a separate admin action.
- Read-only for v1 — no self-submission of assignments. Revisit `AssignmentsService.setSubmission()`'s permission scoping later if that changes; it's a behavior change, not just a new read route.
- A student cannot see the class-wide submissions roster (`GET /assignments/:id/submissions` stays 403 for `STUDENT`) — only their own `submitted` flag, surfaced via `/assignments/me`.

**Done when:** A newly-admitted student can log in with their generated credentials and see only their own attendance history and their own class/section's assignments (with due dates and attachments) — and cannot see or affect any other student's data, or reach any teacher/admin-only route. Verified end-to-end: cross-class isolation (`GET /assignments/:id` for another class's assignment → 403), submissions-roster block (→ 403), every admin/teacher-only route (→ 403), and cascade delete (removing a `Student` invalidates their login immediately).

## MODULE 10.7 — Announcements ✅

Goal: Let admin-tier staff post a notice targeted at one or more audience groups (students, teachers, admins) — every role sees only the notices addressed to them. Not part of the original module list, added after Module 10.6.

**Tables:** `announcements`, `announcement_audiences`

**Backend:**

- `AudienceRole` enum (`STUDENT` / `TEACHER` / `ADMIN`) — deliberately coarser than the six actual roles: `ADMIN` means every admin-tier role (`SUPER_ADMIN`/`DIRECTOR`/`PRINCIPAL`/`ADMIN`) collectively, the same informal grouping Assignments and Dashboards already use ("admin roles see all"), not a literal match on the `ADMIN` role name.
- `AnnouncementAudience` is a join table (composite PK on `announcementId`+`audience`), the same shape as `RolePermission` — chosen over a `Json` array column so "which announcements target TEACHER" stays a plain, indexable relation filter (`audiences: { some: { audience: 'TEACHER' } }`) rather than app-side post-filtering. `Announcement.createdById` is nullable with `onDelete: SetNull`, same reasoning as `AuditLog.userId` — deleting the poster's account later shouldn't erase the announcement, just its attribution.
- `GET /announcements`, `GET /announcements/:id` — no `@RequirePermission` on either: every authenticated role, including `STUDENT`/`TEACHER` who hold no `announcement.*` permission at all, may view announcements addressed to them. `AnnouncementsService` does the actual scoping — admin-tier roles see every announcement (they're the ones managing them, including ones not addressed to `ADMIN`); a `TEACHER`/`STUDENT` only sees rows whose audience list includes their own group. Same "shared route, service does the restriction" pattern used for attendance/assignments elsewhere in this app.
- `POST/PATCH/DELETE /announcements(/:id)` — gated by new `announcement.create`/`.edit`/`.delete` permission keys, granted only to the Management set (`DIRECTOR`/`PRINCIPAL`/`ADMIN`, plus `SUPER_ADMIN` unconditionally) — a bare `TEACHER` cannot post, edit, or delete announcements, only view the ones addressed to `TEACHER`.
- Editing a changed `audiences` list is delete-then-recreate inside one `$transaction`, not a nested Prisma "update" — `AnnouncementAudience` has no single-column id to key an update by (its PK is the `announcementId`+`audience` pair itself).
- Every create/update/delete logs to the Module 10 audit trail (`entityType: 'Announcement'`).

**Frontend:**

- `AnnouncementsListPage.tsx` — every role sees the same list (server-filtered already); admin-tier roles additionally see audience badges and Edit/Delete actions per row plus a "New announcement" button, gated by `hasPermission('announcement.create'/'edit'/'delete')` exactly like Users/Teachers/Students list pages.
- `AnnouncementFormPage.tsx` — title/body/audience-checkboxes, one shared form for create and edit (`isEdit` from `useParams`, same pattern as `StudentFormPage`/`UserFormPage`). Routes `/announcements/new` and `/announcements/:id/edit` are permission-gated; the plain `/announcements` list route isn't gated at all, matching the backend.
- `navConfig.ts`'s "Announcements" entry has neither `permission` nor `roles` — visible to every authenticated user, same as "Dashboard" and "Settings".

**Caught while testing, not by inspection:** a Playwright run logged in as a disposable `ADMIN`-role account and the "New announcement" button never rendered — `hasPermission('announcement.create')` was false even though `ADMIN` is in the Management set. Root cause wasn't the permission-guard logic; it was that `prisma/seed.ts`'s `PERMISSIONS` array had been edited to add the three new keys, but `npm run db:seed` was never re-run against the already-seeded local database, so the new `RolePermission` rows never existed. `SUPER_ADMIN` never surfaced this because it bypasses `PermissionGuard` unconditionally regardless of seeded rows — only `DIRECTOR`/`PRINCIPAL`/`ADMIN` actually depend on the seed. **Any time a new permission key is added to `PERMISSIONS`, re-run `npm run db:seed` against every environment that already has data** — a fresh `prisma migrate dev` does not do this for you.

**Done when:** An admin-tier user can post an announcement targeted at any combination of the three audience groups; a `TEACHER`/`STUDENT` sees only announcements that include their own group and gets 403 fetching one by id that doesn't; a `TEACHER` gets 403 trying to create/edit/delete any announcement; and narrowing an existing announcement's audience away from a group immediately removes it from that group's list.

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
1.5 Password Management     ✅ done (not in the original spec)
2. User Management        ✅ done │  Foundation — do not skip or reorder
3. Academic Structure     ✅ done ─┘
4. Teacher Management     ✅ done ─┐
5. Student Management     ✅ done ─┘  Core data
6. Student Attendance     ✅ done ─┐
7. Teacher Attendance     ✅ done ─┘  Core feature — the reason the app exists
8. Dashboards               ✅ done
9. Reports                  ✅ done
10. Audit Log               ✅ done
10.5 Class Assignments      ✅ done (not in the original spec)
10.6 Student Portal         ✅ done (not in the original spec)
10.7 Announcements          ✅ done (not in the original spec)
11. Notifications          (optional, can slot in anytime after Module 6)
12. Polish & Hardening
```

**Rule of thumb:** Modules 0–5 are foundation — build them in exact order since each depends on the last. Modules 6–7 are your MVP finish line — a school could realistically start using the system at that point. Everything after (8–12) improves the experience but isn't blocking.
