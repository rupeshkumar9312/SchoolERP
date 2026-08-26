import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { AcademicSetupPage } from './pages/AcademicSetupPage';
import { AnnouncementFormPage } from './pages/AnnouncementFormPage';
import { AnnouncementsListPage } from './pages/AnnouncementsListPage';
import { AssignmentsBulkImportPage } from './pages/AssignmentsBulkImportPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AttendanceHistoryPage } from './pages/AttendanceHistoryPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';
import { ToastProvider } from './components/ToastProvider';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardHome } from './pages/DashboardHome';
import { ExamDetailPage } from './pages/ExamDetailPage';
import { ExamFormPage } from './pages/ExamFormPage';
import { ExamMarksEntryPage } from './pages/ExamMarksEntryPage';
import { ExamReportCardPage } from './pages/ExamReportCardPage';
import { ExamSchedulePage } from './pages/ExamSchedulePage';
import { ExamsListPage } from './pages/ExamsListPage';
import { LoginHistoryPage } from './pages/LoginHistoryPage';
import { LoginPage } from './pages/LoginPage';
import { MarkAttendancePage } from './pages/MarkAttendancePage';
import { MyAttendancePage } from './pages/MyAttendancePage';
import { MyClassesPage } from './pages/MyClassesPage';
import { MyExamsPage } from './pages/MyExamsPage';
import { MyStudentsPage } from './pages/MyStudentsPage';
import { NewClassTestPage } from './pages/NewClassTestPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffAttendancePage } from './pages/StaffAttendancePage';
import { StudentAssignmentsPage } from './pages/StudentAssignmentsPage';
import { StudentAttendancePage } from './pages/StudentAttendancePage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentResultsPage } from './pages/StudentResultsPage';
import { StudentsBulkImportPage } from './pages/StudentsBulkImportPage';
import { StudentsListPage } from './pages/StudentsListPage';
import { TeacherAssignmentsPage } from './pages/TeacherAssignmentsPage';
import { TeacherFormPage } from './pages/TeacherFormPage';
import { TeachersListPage } from './pages/TeachersListPage';
import { UserFormPage } from './pages/UserFormPage';
import { UsersListPage } from './pages/UsersListPage';
import { AppShell } from './shell/AppShell';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/settings" element={<SettingsPage />} />

              <Route element={<ProtectedRoute permission="user.view" />}>
                <Route path="/users" element={<UsersListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="user.create" />}>
                <Route path="/users/new" element={<UserFormPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="user.edit" />}>
                <Route path="/users/:id/edit" element={<UserFormPage />} />
              </Route>

              <Route element={<ProtectedRoute permission="academic.view" />}>
                <Route path="/academic-setup" element={<AcademicSetupPage />} />
              </Route>

              <Route element={<ProtectedRoute permission="teacher.view" />}>
                <Route path="/teachers" element={<TeachersListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="teacher.create" />}>
                <Route path="/teachers/new" element={<TeacherFormPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="teacher.edit" />}>
                <Route path="/teachers/:id/edit" element={<TeacherFormPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="teacher.assign" />}>
                <Route path="/teachers/:id/assignments" element={<TeacherAssignmentsPage />} />
              </Route>

              <Route element={<ProtectedRoute permission="student.view" />}>
                <Route path="/students" element={<StudentsListPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="student.create" />}>
                <Route path="/students/new" element={<StudentFormPage />} />
                <Route path="/students/bulk-import" element={<StudentsBulkImportPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="student.edit" />}>
                <Route path="/students/:id/edit" element={<StudentFormPage />} />
              </Route>

              <Route path="/my-classes" element={<MyClassesPage />} />
              <Route path="/my-students" element={<MyStudentsPage />} />

              <Route element={<ProtectedRoute permission="attendance.student.mark" />}>
                <Route path="/attendance/mark" element={<MarkAttendancePage />} />
              </Route>
              <Route element={<ProtectedRoute permission="attendance.student.view" />}>
                <Route path="/attendance/history" element={<AttendanceHistoryPage />} />
              </Route>

              <Route path="/my-attendance" element={<MyAttendancePage />} />
              <Route element={<ProtectedRoute permission="teacher.view" />}>
                <Route path="/staff-attendance" element={<StaffAttendancePage />} />
              </Route>

              <Route element={<ProtectedRoute permission="academic.view" />}>
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              <Route element={<ProtectedRoute permission="assignment.view" />}>
                <Route path="/assignments" element={<AssignmentsPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="assignment.create" />}>
                <Route path="/assignments/bulk-import" element={<AssignmentsBulkImportPage />} />
              </Route>

              <Route element={<ProtectedRoute permission="exam.view" />}>
                <Route path="/exams" element={<ExamsListPage />} />
                <Route path="/exams/:id" element={<ExamDetailPage />} />
                <Route path="/exams/:id/schedules/:scheduleId" element={<ExamSchedulePage />} />
                <Route path="/exams/:id/schedules/:scheduleId/report-card" element={<ExamReportCardPage />} />
              </Route>
              {/* roles, not permission="exam.create" — TEACHER now holds that
                  key too (self-serve class tests via /my-exams/new below),
                  but this admin umbrella form has no class/type restriction
                  and would let a teacher submit a request the backend then
                  has to reject. */}
              <Route element={<ProtectedRoute roles={['SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ADMIN']} />}>
                <Route path="/exams/new" element={<ExamFormPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['TEACHER']} />}>
                <Route path="/my-exams" element={<MyExamsPage />} />
                <Route path="/my-exams/new" element={<NewClassTestPage />} />
                <Route path="/exams/:id/schedules/:scheduleId/marks" element={<ExamMarksEntryPage />} />
              </Route>

              <Route path="/announcements" element={<AnnouncementsListPage />} />
              <Route element={<ProtectedRoute permission="announcement.create" />}>
                <Route path="/announcements/new" element={<AnnouncementFormPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="announcement.edit" />}>
                <Route path="/announcements/:id/edit" element={<AnnouncementFormPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['SUPER_ADMIN']} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/login-history" element={<LoginHistoryPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['STUDENT']} />}>
                <Route path="/student/attendance" element={<StudentAttendancePage />} />
                <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
                <Route path="/student/results" element={<StudentResultsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
