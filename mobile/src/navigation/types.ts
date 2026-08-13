import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StudentHomeworkAssignment, HomeworkAssignment } from '../api/homework';

export type StudentAssignmentsStackParamList = {
  AssignmentsList: undefined;
  AssignmentDetail: { assignment: StudentHomeworkAssignment };
};

export type StudentTabsParamList = {
  Dashboard: undefined;
  Attendance: undefined;
  Assignments: NavigatorScreenParams<StudentAssignmentsStackParamList>;
  Announcements: undefined;
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
  admissionNo: string;
  className: string;
  sectionName: string;
}

export type TeacherClassesStackParamList = {
  ClassesList: undefined;
  Roster: ClassSectionRef;
  MarkAttendance: ClassSectionRef;
  StudentSearch: undefined;
  StudentAttendanceHistory: StudentRef;
};

export type TeacherAssignmentsStackParamList = {
  AssignmentsList: undefined;
  AssignmentDetail: { assignment: HomeworkAssignment };
  NewAssignment: undefined;
};

export type TeacherDashboardStackParamList = {
  DashboardHome: undefined;
  MyAttendance: undefined;
};

export type TeacherTabsParamList = {
  Dashboard: NavigatorScreenParams<TeacherDashboardStackParamList>;
  Classes: NavigatorScreenParams<TeacherClassesStackParamList>;
  Assignments: NavigatorScreenParams<TeacherAssignmentsStackParamList>;
  Announcements: undefined;
  Settings: undefined;
};
