export interface NavItem {
  label: string;
  path: string;
  /** Omit for items every authenticated user should see. */
  permission?: string;
  /** Restrict to specific role names instead of/alongside a permission — for
   * self-service pages (e.g. a teacher's own classes) with no permission key. */
  roles?: string[];
}

// Every later module just adds an entry here — AppShell renders this list
// filtered by the signed-in user's permissions[] and/or role.
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Users', path: '/users', permission: 'user.view' },
  { label: 'Academic Setup', path: '/academic-setup', permission: 'academic.view' },
  { label: 'Teachers', path: '/teachers', permission: 'teacher.view' },
  { label: 'Students', path: '/students', permission: 'student.view' },
  { label: 'My Classes', path: '/my-classes', roles: ['TEACHER'] },
  { label: 'My Students', path: '/my-students', roles: ['TEACHER'] },
  { label: 'Mark Attendance', path: '/attendance/mark', permission: 'attendance.student.mark' },
  { label: 'Attendance History', path: '/attendance/history', permission: 'attendance.student.view' },
  { label: 'My Attendance', path: '/my-attendance', roles: ['TEACHER'] },
  { label: 'Staff Attendance', path: '/staff-attendance', permission: 'teacher.view' },
  { label: 'Reports', path: '/reports', permission: 'academic.view' },
  { label: 'Assignments', path: '/assignments', permission: 'assignment.view' },
  { label: 'My Attendance', path: '/student/attendance', roles: ['STUDENT'] },
  { label: 'My Assignments', path: '/student/assignments', roles: ['STUDENT'] },
  { label: 'Audit Log', path: '/audit-logs', roles: ['SUPER_ADMIN'] },
];
