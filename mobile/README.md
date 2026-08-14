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

`.env` is **only used for local `expo start` dev sessions** — it's git-ignored and does not reach EAS Build (see below), which reads `EXPO_PUBLIC_API_URL` from its own project environment variables instead.

Every role can log in now (see below) — there's no separate build per role.

## Building a production APK

The app is linked to EAS (`app.json`'s `extra.eas.projectId`, account `rupesh9312`). `eas.json`'s `production` profile is set to `android.buildType: "apk"` (not the Play-Store-only `.aab`), so the output installs directly on a device via sideload.

```bash
cd mobile
npx eas-cli build --platform android --profile production
```

This runs on Expo's servers (10–25 min) and prints a `https://expo.dev/artifacts/eas/....apk` link when done — open that on the device, or transfer the file over, and install (Android will prompt to allow installing from that source).

**Before building**, make sure the API URL is right — it's baked into the JS bundle at build time, not read at runtime:

```bash
npx eas-cli env:set production --name EXPO_PUBLIC_API_URL --value <url> --visibility plaintext --force
```

Currently set to `https://school-erp-ashy-zeta.vercel.app/api` for both the `production` and `preview` profiles. Changing it requires a new build to take effect — there's no way to point an already-built APK at a different backend.

## Who can use it

| Role | Access |
|---|---|
| **STUDENT** | Dashboard, own attendance history, own assignments (view + download attachments), announcements addressed to them, settings/change password. |
| **TEACHER** | Dashboard, my classes (roster, mark attendance for homeroom sections, date-range attendance history for homeroom sections), search any student they teach + view attendance history (date-range filterable), my own attendance (mark/history), assignments (create/edit/delete for their own, submission tracking), announcements (read-only — no `announcement.*` permission), settings. |
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
- **Date fields**: every date input uses `components/DateField.tsx`, which opens the native Android date dialog via `@react-native-community/datetimepicker` and stores the result as a `YYYY-MM-DD` string — same wire format as before, just no more manual typing. (Earlier versions of this app used plain text inputs to avoid a native module; confirmed this package ships inside Expo Go itself for SDK 54, so it didn't require a dev-client rebuild.) Fields with a natural cross-constraint (Reports/Audit Log From↔To, assignment due date → repeat-until, student date of birth ≤ today) pass `minimumDate`/`maximumDate` so the picker itself won't offer an invalid date.
- **Fonts**: Inter (body) + Lexend (headings) loaded via `@expo-google-fonts/*`, loaded once in `App.tsx` behind a loading gate. Custom font files ignore React Native's `fontWeight` on Android, so every style uses the `fonts.*` tokens (e.g. `fonts.bodySemiBold`) instead of `fontWeight`.
- **Touch feedback**: every tappable surface routes through `components/Touchable.tsx` — native Android ripple + a small press-in scale animation. `Pressable` is used bare only for the SelectField modal's invisible dismiss-backdrop.
- **Modals and safe-area insets**: a React Native `Modal` renders outside the app's normal `SafeAreaView` tree, so it never automatically avoids the Android system nav bar — `SelectField`'s dropdown sheet adds `insets.bottom` (via `useSafeAreaInsets()`) to its bottom padding explicitly. This only became visible in a compiled build (production APK draws edge-to-edge per its `targetSdkVersion`); Expo Go's own shell doesn't enforce edge-to-edge the same way, so the bug was invisible there. Any future bottom-sheet-style `Modal` needs the same treatment.
- **List/detail pattern**: any screen showing structured record data (Roster, Class attendance, My Classes) uses `DataRow`/`DataRowText` — a bordered card per record with label-left/value-right rows — reproducing web's `.data-table` mobile-responsive CSS rule exactly, rather than a native `<table>` equivalent.
- **Header**: every screen inside the authenticated app shows the EDVANCE logo centered + a logout icon on the right instead of a screen title (`brandedHeaderOptions`), mirroring web's persistent `AppShell` topbar. Native back buttons are preserved (only `headerTitle`/`headerRight` are overridden, never the full `header`).
- **Attendance history date ranges**: both `GET /attendance/students/:studentId/history` (per-student) and `GET /attendance/students` (per-class, via new optional `from`/`to` query params alongside the existing exact-match `date`) support an optional bounded range — omit both for full history. `ListAttendanceQueryDto.date` is now optional; the service prefers an exact `date` match when present (mark-attendance flows always pass it) and falls back to a `from`/`to` range otherwise. A TEACHER viewing a class range is still gated by `assertIsClassTeacher` — only their own homeroom section, same as marking.
- **Permission-gated UI**: mirrors web's `useAuth().hasPermission(key)` pattern exactly — same permission strings, same backend source of truth. A screen/button only appears if the signed-in user's `permissions[]` (returned on `/auth/me`) includes the required key.
- **Push notifications**: on login (and on session-restore at app launch), the app requests notification permission and registers this device's Expo push token via `POST /push-tokens` (`src/notifications/pushRegistration.ts`); unregisters it on logout. When an announcement is created, `AnnouncementsService.create()` (backend) calls `PushNotificationService.notifyAudiences()`, which re-derives the recipient list using the **exact same** STUDENT/TEACHER/"everyone else is ADMIN" grouping `GET /announcements` already uses to decide who can *see* an announcement — so push targeting can never drift out of sync with in-app visibility. Sent via `expo-server-sdk`, `await`ed (not fire-and-forget) inside the request handler because the production API runs on Vercel serverless functions, which freeze right after the response is sent — an un-awaited send would risk never completing. A push failure is caught and logged; it never fails the announcement itself. Tapping a notification navigates to the Announcements tab (`src/notifications/notificationNavigation.ts` + `useNotificationResponseHandler.ts`, handles both a cold app-launch tap and a tap while already running). **Requires your own Firebase project** for Android delivery (Expo no longer proxies through a shared one) — see Next steps.
- **Splash screen**: configured via the `expo-splash-screen` config plugin (`app.json`, image = `assets/edvance-logo.png`) — this bakes into native Android launch resources at build time, so it only renders in a compiled binary (`npx expo run:android` dev client, or an EAS/production build). **It will not appear in the public Expo Go app** — Expo Go is a fixed pre-built shell and always shows its own generic loading screen regardless of this config. `App.tsx` calls `SplashScreen.preventAutoHideAsync()`/`hideAsync()` so the splash (where it does apply) stays up through font loading instead of handing off to a bare spinner.

## Changelog

- **Initial build** — Expo app scaffolded (SDK 57 → downgraded to 54 for Expo Go compatibility), STUDENT/TEACHER-only scope locked in, core auth/navigation/API-client infrastructure, one screen per web page for both roles, attachment upload/download.
- **Design parity pass** — every screen rebuilt to match its web equivalent exactly: greeting/date header, `DataRow` record cards replacing ad-hoc layouts, Inter/Lexend fonts replacing `fontWeight`, teacher self-attendance ("My Attendance" — was entirely missing), assignment "repeat weekly until" + create-time attachment upload (also missing), announcements read-only card layout.
- **Global chrome** — branded header (logo + logout icon, no screen title) applied to every screen; native Android ripple + press-scale (`Touchable`) applied to every button/card/chip app-wide.
- **Student search + attendance history** — teachers/admins can search any student they have access to and view their full attendance history (`GET /attendance/students/:id/history`, new backend endpoint), reachable from Roster rows and a dedicated search screen.
- **Admin mobile access (Phase 1)** — reversed the original Student/Teacher-only scope decision. All four ADMIN-tier roles now get a `AdminTabs` navigator: dashboard with school-wide stats, attendance (by class & date with inline correction, by-student search, staff attendance), full announcement CRUD.
- **Admin mobile access (Phase 2)** — added a "Manage" tab (`ManageStackParamList`, hub screen gated per-card by `hasPermission`) with: **Users** (list + filter by role, create/edit, SUPER_ADMIN-only password reset, delete); **Academic Setup** (academic years with set-current/delete, classes → sections & subjects via a shared `NamedItemList` component with inline rename, holidays); **Teachers** (list + create/edit/delete, plus a dedicated Assignments screen — cascading year→class→section→multi-subject picker, class-teacher hand-off/removal); **Students** (list with cascading year/class/section filters + debounced search, create/edit/delete, auto-generated portal login shown once on admission). Reports, Audit Log, students `.xlsx` bulk import, and admin bulk "mark from scratch" attendance remained deferred to Phase 3.
- **Admin mobile access (Phase 3)** — closed out the remaining admin gaps: **Students bulk import** (`.xlsx` upload via `expo-document-picker`, per-row failure report, template download and failures-workbook share via a new `shareBase64File` util); **Reports** (Summary/Defaulters/Staff tabs, cascading year/class/section + date-range filters, simple bar rows for class attendance %, per-student/staff breakdown cards, CSV share via new `csv.ts` + `shareTextFile` util — a mobile-appropriate rebuild of web's table+chart layout, not a direct port); **Audit Log** (SUPER_ADMIN only, filterable by entity type/actor/date range, tap a row to expand before/after JSON); **admin bulk "Mark Attendance"** (`AdminMarkAttendanceScreen`, reachable from the Attendance tab's hub — cascading class/section picker + editable date, unlike the teacher version which is locked to today) for marking a class from scratch, not just correcting existing records. This closes full admin/web parity for the mobile app.
- **Scroll-clipping fix** — `Screen.tsx`'s `KeyboardAvoidingView` used `behavior="height"` on Android, which conflicts with `app.json`'s `softwareKeyboardLayoutMode: "resize"` (the OS already handles keyboard resizing) and could lock in a stale, too-short height after a tab switch — clipping the bottom of longer screens (Manage, Attendance hub) so it couldn't be scrolled into view. Fixed by making the behavior a no-op on Android (`undefined`, only `"padding"` on iOS) and adding extra bottom padding to the scroll content. Affects every screen, since it's in the shared `Screen` component.
- **Splash screen** — replaced the default Expo splash with the EDVANCE logo via the `expo-splash-screen` config plugin; see the architecture note above for the Expo Go caveat.
- **App icon** — `assets/icon.png` and the three `android-icon-*.png` adaptive-icon layers were the default Expo template placeholder (a generic blue "A" graphic), not the EDVANCE mark. `assets/edvance-logo.png` (the only real brand asset in the repo) is a wordmark lockup where the icon graphic and the "EDVANCE" text overlap in the same raster region, so there was no clean rectangular crop for an icon-only mark — regenerated it by color/position-masking out the wordmark and tagline pixels (keep blue ribbon/house + green window panes everywhere, keep the dark charcoal cap only above y≈70) to isolate just the graduation-cap-on-a-house mark, then composed it into `icon.png` (1024×1024, opaque `#E6F4FE` background), `android-icon-foreground.png` (512×512, transparent, sized to Android's adaptive-icon safe zone), `android-icon-background.png` (512×512, solid `#E6F4FE` fill), and `android-icon-monochrome.png` (432×432, white silhouette, for Android 13+ themed icons). Same Expo Go caveat as the splash screen — see below.
- **First production APK / EAS setup** — project linked to EAS (`app.json`'s `extra.eas.projectId`, owner `rupesh9312`), `eas.json` added with `development`/`preview`/`production` profiles all set to `android.buildType: "apk"` (a plain production profile defaults to a Play-Store-only `.aab`, which can't be sideloaded). Learned the hard way that `EXPO_PUBLIC_*` values only reach a build if they're actually uploaded with the project — `.env` is git-ignored, and EAS's archive step is git-aware, so it was silently excluded from the very first build (which shipped with client.ts's emulator-only fallback URL baked in). Fixed by setting `EXPO_PUBLIC_API_URL` as a proper EAS project environment variable (`eas env:set production ...` / `preview ...`) instead of relying on the local `.env` file — see Quick start.
- **Date pickers** — every `YYYY-MM-DD` text input replaced with a real native date picker; see the architecture note above.
- **Dropdown clipped by system nav bar (production build only)** — `SelectField`'s bottom-sheet `Modal` had no safe-area padding, so on a compiled/edge-to-edge APK the last option(s) rendered behind the Android nav bar; invisible in Expo Go. Fixed with `useSafeAreaInsets()`; see the architecture note above.
- **Attendance history date ranges** — the per-student history screen (`StudentAttendanceHistoryScreen`) gained From/To `DateField`s, and a brand new `ClassAttendanceHistoryScreen` (reachable from "My Classes" → "Attendance history", class-teacher sections only) shows a whole section's attendance grouped by day over a date range (defaults to the last 7 days). Backend: `GET /attendance/students` (per-class) now accepts optional `from`/`to` alongside the existing exact-match `date`; `GET /attendance/students/:id/history` (per-student) already had this from the previous change. See the architecture note above.
- **Accidental submission-toggle fix** — `TeacherAssignmentDetailScreen`'s submissions list had the *entire row* as one tap target that called the submission-update API immediately on press, with no confirmation — easy to trigger by accident (a stray tap while scrolling, or tapping near the student's name). Fixed two ways: the tappable area is now just the status `Badge` itself (not the full row), and tapping it opens an `Alert.alert` confirmation ("Mark as Submitted?"/"Mark as Pending?") before the API call fires — matching how every other state-changing action in the app (delete, remove attachment) already confirms first.
- **Push notifications on announcement creation** — new backend `PushToken` model/migration + `POST`/`DELETE /push-tokens`, `PushNotificationService`; mobile registers/unregisters on login/logout and navigates to Announcements on tap. Firebase project created, FCM V1 service account uploaded to EAS, `google-services.json` wired into `app.json` (deliberately kept out of `.gitignore` — same reason as the `.env` lesson: EAS Build's archive step is git-aware and skips ignored files). Shipped end-to-end and deployed.
- **`expo-server-sdk` crashed production on boot** — it ships ESM-only (`"type": "module"`), and a CommonJS-compiled Nest app doing `require()` on an ESM-only package throws immediately at load time. Since `PushNotificationsModule` sits in the import graph reached by `AppModule`, this crashed *every* route in production, not just push ones (`nest start`'s dev-mode compiler masked it locally, which is why it wasn't caught before deploying). Fixed by dropping the SDK and POSTing to Expo's push API directly over plain `fetch` — confirmed via an actual compiled-and-executed build (not dev mode) before redeploying. Lesson: don't trust `nest start --watch` to represent how the app behaves once actually built and run, for module-resolution-sensitive dependencies especially.
- **Untappable audience chips on the announcement form** — the "Visible to" Student/Teacher/Admin chips didn't respond to taps at all (no ripple) on a real device, while everything else on the same screen worked fine. Best diagnosis without device access: `flexDirection: row` + `flexWrap: wrap` + `gap` rows of `Touchable` children can render in the right place while their native touch-hit rect falls out of sync on Android — replaced `gap` with explicit `marginRight`/`marginBottom` on the chips (functionally identical layout, different mechanism) and added `hitSlop`. Applied the same fix to `TeacherAssignmentsScreen`'s subject multi-select chips, the one other place with the identical `Touchable` + `flexWrap` + `gap` shape — not yet reported broken, but same latent risk. **Unconfirmed without a real-device retest** — flag here if it recurs after the next build, since the exact root cause couldn't be fully verified from code alone.
- **Push notifications on new assignments** — `PushNotificationService` gained `notifyClassSectionStudents`, scoped to just the students of one class+section (unlike the audience-wide `notifyAudiences` used for announcements); `AssignmentsService.create()` calls it after saving, best-effort. Tapping the notification navigates to the student's Assignments tab, same pattern as the announcement tap handler. Also fires once per row for a recurring-weekly creation's bulk import path (`AssignmentsBulkImportService`, which reuses `create()`), so a large `.xlsx` import currently sends one push per row — flagged as a possible follow-up, not yet changed.

## Next steps

No admin feature gaps remain — web and mobile are at parity for every role. Remaining items are lower-priority polish, not missing screens:

- **Push notifications need a Firebase project before they'll actually deliver.** Code is done (backend + mobile), but Android push goes through Firebase Cloud Messaging and Expo requires your own FCM credentials, not a shared one. To finish: (1) create a free Firebase project, add an Android app with package name `dev.schoolerp.edvance`; (2) generate a Firebase service-account key; (3) `eas credentials` to upload it for this project. Then a new dev-client or production build — **Expo Go does not support remote push notifications on Android**, same category of limitation as the splash screen/app icon.
- No offline support / request queuing.
- iOS untested and not a current goal.
- Reports' bar rows are a simplified mobile rebuild of web's chart layout, not a pixel-for-pixel port — revisit if stakeholders want richer charts on mobile.
- **Splash screen and app icon changes need a dev-client or production build to actually preview** — both are baked into native resources at build time and Expo Go (a fixed pre-built shell) won't reflect either one; see the architecture notes above.

## Troubleshooting

- **Changes not showing up**: check `ps aux | grep sudo` for a stray `sudo npx expo start`/`sudo npm run start` in another terminal tab — this has happened repeatedly on this machine and serves stale bundles from wherever that process's cwd was (including `~/.Trash` once). Kill it (no sudo needed if it's your own process) and restart `npx expo start -c` normally.
- **"Found screens with the same name nested inside one another"**: a tab route and the first screen inside its nested stack must not share a name (e.g. `Dashboard` tab → `Dashboard` screen). Give the inner screen a distinct name (see `TeacherDashboardStackParamList.DashboardHome`).
- **Expo Go says the project is incompatible**: the SDK version in `package.json` has outrun what the public Expo Go app supports. Check `AGENTS.md` and downgrade via `npx expo install expo@<version> && npx expo install --fix`.
