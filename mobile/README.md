# EDVANCE Mobile

Native React Native/Expo Android app for the SchoolERP backend (`../backend`) — not a WebView wrapper. Reuses the same REST API as `../frontend`, with one small additive backend change (a mobile-aware refresh-token header) that leaves web behavior untouched.

**Platform: Android only.** iOS has not been built or tested — `app.json` has no `ios` key.

## Tech stack

- Expo SDK **54**, pinned deliberately (see `AGENTS.md`) — Expo Go's public release doesn't support newer SDKs yet. Check that before bumping.
- React Native 0.81.5, React 19.1.0, TypeScript.
- `@react-navigation` (native-stack + bottom-tabs).
- `expo-secure-store` for tokens, `expo-document-picker` + `expo-file-system` + `expo-sharing` for assignment attachments, `@expo-google-fonts/inter` + `@expo-google-fonts/lexend` for the same fonts the web app uses.
- No Redux/MobX/etc — plain `useState`/`useCallback` + one `AuthContext`, matching the web app's simplicity.

## Quick start

```bash
cd mobile
npm install
npx expo start -c        # never with sudo — see Troubleshooting
```

Edit `.env` first (copy from `.env.example`): `EXPO_PUBLIC_API_URL` — `http://10.0.2.2:4000/api` reaches the host machine's backend from the Android emulator; a physical device on the same Wi-Fi needs the machine's LAN IP instead. Must match `backend/.env`'s `PORT`. Scan the QR code with the **Expo Go** app.

Every role can log in now (see below) — there's no separate build per role.

## Who can use it

| Role | Access |
|---|---|
| **STUDENT** | Dashboard, own attendance history, own assignments (view + download attachments), announcements addressed to them, settings/change password. |
| **TEACHER** | Dashboard, my classes (roster, mark attendance for homeroom sections), search any student they teach + view attendance history, my own attendance (mark/history), assignments (create/edit/delete for their own, submission tracking), announcements (read-only — no `announcement.*` permission), settings. |
| **ADMIN-tier** (SUPER_ADMIN, DIRECTOR, PRINCIPAL, ADMIN) | Dashboard (school-wide stats + today's attendance breakdowns), attendance (mark from scratch for any class/section/date, by class & date with inline correction, by-student search across the whole school, staff attendance for any teacher), **Manage** tab — Users (CRUD + role assignment + SUPER_ADMIN password reset), Academic Setup (years/classes/sections/subjects/holidays CRUD), Teachers (CRUD + class/subject assignment + class-teacher hand-off), Students (CRUD, cascading year/class/section filters + search + `.xlsx` bulk import), Reports (attendance summary/defaulters/staff, CSV share), Audit Log (SUPER_ADMIN only) — announcements (full create/edit/delete), settings. Full admin parity with web now shipped — see Next Steps for remaining polish items. |

Any other/future role falls through to `UnsupportedRoleScreen` (a defensive fallback, not expected to be reachable given the four roles above cover every role the backend seeds).

## Project structure

```
src/
  api/            One file per backend resource (attendance.ts, students.ts, ...),
                   thin wrappers around client.ts. Mirrors frontend/src/api/*.ts
                   shapes where the same resource is used on web.
  auth/           AuthContext (login/logout/refresh/hasPermission) + SecureStore token cache.
  components/     Shared UI kit — Button, Card, Badge, DataRow (label/value row
                   matching web's responsive .data-table row style), SearchInput,
                   SelectField, Touchable (ripple + press-scale wrapper), Screen
                   (SafeAreaView + KeyboardAvoidingView + ScrollView/RefreshControl).
  navigation/     RootNavigator (auth/role switch) → StudentTabs / TeacherTabs /
                   AdminTabs, each a bottom-tab navigator wrapping per-feature
                   native-stacks. brandedHeaderOptions + AnnouncementsStackNavigator
                   are shared across all three role navigators.
  screens/        student/, teacher/, admin/ subfolders + role-agnostic screens
                   (Login, Settings, Announcements, ForcedChangePassword) at the root.
                   admin/ includes a ManageHomeScreen hub (Users, Academic Setup,
                   Teachers, Students, Reports, Audit Log) reachable from AdminTabs'
                   "Manage" tab, plus AdminMarkAttendanceScreen (mark-from-scratch)
                   reachable from the Attendance tab's hub.
  theme.ts        Colors/spacing/radius/fonts tokens mirrored from frontend/src/index.css.
  utils/          format.ts (dates), download.ts (attachment open/share + base64/text
                   file share for generated workbooks and CSVs), csv.ts (CSV building).
```

## Key architecture decisions

- **Auth**: access token kept in memory (`tokenStore.ts`) for synchronous reads on every request; refresh token in `expo-secure-store`. Web relies solely on an httpOnly cookie for the refresh token, which doesn't survive native app restarts reliably — so `POST /auth/login` and `/auth/refresh` return `refreshToken` in the JSON body **only** when the request carries an `X-Client: mobile` header (`backend/src/auth/auth.controller.ts`). Web never sends that header, so its behavior is byte-for-byte unchanged.
- **401 retry**: concurrent 401s during a token refresh all await one in-flight `refreshAccessToken()` promise (`api/client.ts`) instead of each firing their own `/auth/refresh` call.
- **No native date picker dependency** — due-date/date fields are plain `YYYY-MM-DD` text inputs, matching a deliberate decision made early on to avoid an extra native module.
- **Fonts**: Inter (body) + Lexend (headings) loaded via `@expo-google-fonts/*`, loaded once in `App.tsx` behind a loading gate. Custom font files ignore React Native's `fontWeight` on Android, so every style uses the `fonts.*` tokens (e.g. `fonts.bodySemiBold`) instead of `fontWeight`.
- **Touch feedback**: every tappable surface routes through `components/Touchable.tsx` — native Android ripple + a small press-in scale animation. `Pressable` is used bare only for the SelectField modal's invisible dismiss-backdrop.
- **List/detail pattern**: any screen showing structured record data (Roster, Class attendance, My Classes) uses `DataRow`/`DataRowText` — a bordered card per record with label-left/value-right rows — reproducing web's `.data-table` mobile-responsive CSS rule exactly, rather than a native `<table>` equivalent.
- **Header**: every screen inside the authenticated app shows the EDVANCE logo centered + a logout icon on the right instead of a screen title (`brandedHeaderOptions`), mirroring web's persistent `AppShell` topbar. Native back buttons are preserved (only `headerTitle`/`headerRight` are overridden, never the full `header`).
- **Permission-gated UI**: mirrors web's `useAuth().hasPermission(key)` pattern exactly — same permission strings, same backend source of truth. A screen/button only appears if the signed-in user's `permissions[]` (returned on `/auth/me`) includes the required key.

## Changelog

- **Initial build** — Expo app scaffolded (SDK 57 → downgraded to 54 for Expo Go compatibility), STUDENT/TEACHER-only scope locked in, core auth/navigation/API-client infrastructure, one screen per web page for both roles, attachment upload/download.
- **Design parity pass** — every screen rebuilt to match its web equivalent exactly: greeting/date header, `DataRow` record cards replacing ad-hoc layouts, Inter/Lexend fonts replacing `fontWeight`, teacher self-attendance ("My Attendance" — was entirely missing), assignment "repeat weekly until" + create-time attachment upload (also missing), announcements read-only card layout.
- **Global chrome** — branded header (logo + logout icon, no screen title) applied to every screen; native Android ripple + press-scale (`Touchable`) applied to every button/card/chip app-wide.
- **Student search + attendance history** — teachers/admins can search any student they have access to and view their full attendance history (`GET /attendance/students/:id/history`, new backend endpoint), reachable from Roster rows and a dedicated search screen.
- **Admin mobile access (Phase 1)** — reversed the original Student/Teacher-only scope decision. All four ADMIN-tier roles now get a `AdminTabs` navigator: dashboard with school-wide stats, attendance (by class & date with inline correction, by-student search, staff attendance), full announcement CRUD.
- **Admin mobile access (Phase 2)** — added a "Manage" tab (`ManageStackParamList`, hub screen gated per-card by `hasPermission`) with: **Users** (list + filter by role, create/edit, SUPER_ADMIN-only password reset, delete); **Academic Setup** (academic years with set-current/delete, classes → sections & subjects via a shared `NamedItemList` component with inline rename, holidays); **Teachers** (list + create/edit/delete, plus a dedicated Assignments screen — cascading year→class→section→multi-subject picker, class-teacher hand-off/removal); **Students** (list with cascading year/class/section filters + debounced search, create/edit/delete, auto-generated portal login shown once on admission). Reports, Audit Log, students `.xlsx` bulk import, and admin bulk "mark from scratch" attendance remained deferred to Phase 3.
- **Admin mobile access (Phase 3)** — closed out the remaining admin gaps: **Students bulk import** (`.xlsx` upload via `expo-document-picker`, per-row failure report, template download and failures-workbook share via a new `shareBase64File` util); **Reports** (Summary/Defaulters/Staff tabs, cascading year/class/section + date-range filters, simple bar rows for class attendance %, per-student/staff breakdown cards, CSV share via new `csv.ts` + `shareTextFile` util — a mobile-appropriate rebuild of web's table+chart layout, not a direct port); **Audit Log** (SUPER_ADMIN only, filterable by entity type/actor/date range, tap a row to expand before/after JSON); **admin bulk "Mark Attendance"** (`AdminMarkAttendanceScreen`, reachable from the Attendance tab's hub — cascading class/section picker + editable date, unlike the teacher version which is locked to today) for marking a class from scratch, not just correcting existing records. This closes full admin/web parity for the mobile app.

## Next steps

No admin feature gaps remain — web and mobile are at parity for every role. Remaining items are lower-priority polish, not missing screens:

- No push notifications.
- No offline support / request queuing.
- iOS untested and not a current goal.
- Reports' bar rows are a simplified mobile rebuild of web's chart layout, not a pixel-for-pixel port — revisit if stakeholders want richer charts on mobile.

## Troubleshooting

- **Changes not showing up**: check `ps aux | grep sudo` for a stray `sudo npx expo start`/`sudo npm run start` in another terminal tab — this has happened repeatedly on this machine and serves stale bundles from wherever that process's cwd was (including `~/.Trash` once). Kill it (no sudo needed if it's your own process) and restart `npx expo start -c` normally.
- **"Found screens with the same name nested inside one another"**: a tab route and the first screen inside its nested stack must not share a name (e.g. `Dashboard` tab → `Dashboard` screen). Give the inner screen a distinct name (see `TeacherDashboardStackParamList.DashboardHome`).
- **Expo Go says the project is incompatible**: the SDK version in `package.json` has outrun what the public Expo Go app supports. Check `AGENTS.md` and downgrade via `npx expo install expo@<version> && npx expo install --fix`.
