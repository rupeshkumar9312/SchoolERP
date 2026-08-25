import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Announcement } from '../api/announcements';
import type { TeacherExamEntry } from '../api/exams';
import type { StudentHomeworkAssignment, HomeworkAssignment } from '../api/homework';
import type { Student } from '../api/students';
import type { Teacher } from '../api/teachers';
import type { UserListItem } from '../api/users';

export type StudentAssignmentsStackParamList = {
  AssignmentsList: undefined;
  AssignmentDetail: { assignment: StudentHomeworkAssignment };
};

// Shared by Student/Teacher/Admin tabs — only ADMIN-tier roles ever navigate
// to AnnouncementForm (the screen itself hides the "+ New"/Edit affordances
// behind hasPermission checks), but every role gets the same tiny stack so
// the shared AnnouncementsScreen component's navigation prop type is uniform.
export type AnnouncementsStackParamList = {
  AnnouncementsList: undefined;
  AnnouncementForm: { announcement?: Announcement } | undefined;
};

export type StudentTabsParamList = {
  Dashboard: undefined;
  Attendance: undefined;
  Assignments: NavigatorScreenParams<StudentAssignmentsStackParamList>;
  Announcements: NavigatorScreenParams<AnnouncementsStackParamList>;
  Settings: undefined;
};

export interface ClassSectionRef {
  classId: number;
  sectionId: number;
  className: string;
  sectionName: string;
}

export interface StudentRef {
  studentId: number;
  studentName: string;
  admissionNo: string | null;
  className: string;
  sectionName: string;
}

export type TeacherClassesStackParamList = {
  ClassesList: undefined;
  Roster: ClassSectionRef;
  MarkAttendance: ClassSectionRef;
  ClassAttendanceHistory: ClassSectionRef;
  StudentSearch: undefined;
  StudentAttendanceHistory: StudentRef;
};

export type TeacherAssignmentsStackParamList = {
  AssignmentsList: undefined;
  AssignmentDetail: { assignment: HomeworkAssignment };
  NewAssignment: undefined;
};

export type TeacherExamsStackParamList = {
  ExamsList: undefined;
  MarksEntry: { entry: TeacherExamEntry };
};

export type TeacherDashboardStackParamList = {
  DashboardHome: undefined;
  MyAttendance: undefined;
};

export type TeacherTabsParamList = {
  Dashboard: NavigatorScreenParams<TeacherDashboardStackParamList>;
  Classes: NavigatorScreenParams<TeacherClassesStackParamList>;
  Assignments: NavigatorScreenParams<TeacherAssignmentsStackParamList>;
  Exams: NavigatorScreenParams<TeacherExamsStackParamList>;
  Announcements: NavigatorScreenParams<AnnouncementsStackParamList>;
  Settings: undefined;
};

export type AdminAttendanceStackParamList = {
  AttendanceHome: undefined;
  ClassAttendance: undefined;
  MarkAttendance: undefined;
  StaffAttendance: undefined;
  StudentSearch: undefined;
  StudentAttendanceHistory: StudentRef;
};

export type ManageStackParamList = {
  ManageHome: undefined;
  UsersList: undefined;
  UserForm: { user?: UserListItem } | undefined;
  AcademicSetup: undefined;
  TeachersList: undefined;
  TeacherForm: { teacher?: Teacher } | undefined;
  TeacherAssignments: { teacherId: number; teacherName: string };
  StudentsList: undefined;
  StudentForm: { student?: Student } | undefined;
  StudentsBulkImport: undefined;
  Reports: undefined;
  AuditLog: undefined;
};

export type AdminTabsParamList = {
  Dashboard: undefined;
  Attendance: NavigatorScreenParams<AdminAttendanceStackParamList>;
  Manage: NavigatorScreenParams<ManageStackParamList>;
  Announcements: NavigatorScreenParams<AnnouncementsStackParamList>;
  Settings: undefined;
};
