import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { AcademicSetupPage } from './pages/AcademicSetupPage';
import { AssignmentsBulkImportPage } from './pages/AssignmentsBulkImportPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AttendanceHistoryPage } from './pages/AttendanceHistoryPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';
import { ToastProvider } from './components/ToastProvider';
import { DashboardHome } from './pages/DashboardHome';
import { LoginPage } from './pages/LoginPage';
import { MarkAttendancePage } from './pages/MarkAttendancePage';
import { MyAttendancePage } from './pages/MyAttendancePage';
import { MyClassesPage } from './pages/MyClassesPage';
import { MyStudentsPage } from './pages/MyStudentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffAttendancePage } from './pages/StaffAttendancePage';
import { StudentFormPage } from './pages/StudentFormPage';
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
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardHome />} />

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

              <Route element={<ProtectedRoute roles={['SUPER_ADMIN']} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
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
