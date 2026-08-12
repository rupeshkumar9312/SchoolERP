import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  presentPercent: number | null;
}

export interface AdminSummaryView {
  academicYear: { id: number; name: string } | null;
  totals: { students: number; teachers: number; classes: number; sections: number };
  studentAttendanceToday: AttendanceBreakdown & {
    date: string;
    totalStudents: number;
    sectionsMarked: number;
    totalSections: number;
  };
  teacherAttendanceToday: AttendanceBreakdown & { date: string; totalTeachers: number };
}

export interface TeacherClassView {
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string } | null;
  isClassTeacher: boolean;
}

export interface TeacherSummaryView {
  teacher: { id: number; name: string };
  classes: TeacherClassView[];
  classTeacherOf: Array<{
    class: { id: number; name: string };
    section: { id: number; name: string };
    attendanceMarkedToday: boolean;
  }>;
  myAttendanceToday: { status: AttendanceStatus } | null;
}

export interface StudentSummaryView {
  student: {
    id: number;
    name: string;
    admissionNo: string;
    class: { id: number; name: string };
    section: { id: number; name: string };
  };
  myAttendanceToday: { status: AttendanceStatus } | null;
  attendanceThisMonth: { present: number; totalMarked: number; presentPercent: number | null };
  upcomingAssignments: Array<{
    id: number;
    title: string;
    subject: { id: number; name: string };
    dueDate: Date;
  }>;
}

const EMPTY_BREAKDOWN: AttendanceBreakdown = {
  present: 0,
  absent: 0,
  late: 0,
  leave: 0,
  totalMarked: 0,
  presentPercent: null,
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminSummary(): Promise<AdminSummaryView> {
    const today = this.todayUtcDate();
    const currentYear = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });

    // Scope headline counts to the current academic year when one is set —
    // otherwise every year's history would inflate "how big is the school right now."
    const classWhere = currentYear ? { academicYearId: currentYear.id } : {};
    const [totalStudents, totalTeachers, totalClasses, totalSections] = await Promise.all([
      this.prisma.student.count({ where: { isActive: true, class: classWhere } }),
      this.prisma.teacher.count(),
      this.prisma.class.count({ where: classWhere }),
      this.prisma.section.count({ where: { class: classWhere } }),
    ]);

    const [studentRows, sectionsMarkedRows, teacherRows] = await Promise.all([
      this.prisma.studentAttendance.groupBy({
        by: ['status'],
        where: { date: new Date(today), student: { class: classWhere } },
        _count: { _all: true },
      }),
      this.prisma.studentAttendance.findMany({
        where: { date: new Date(today), student: { class: classWhere } },
        select: { sectionId: true },
        distinct: ['sectionId'],
      }),
      this.prisma.teacherAttendance.groupBy({
        by: ['status'],
        where: { date: new Date(today) },
        _count: { _all: true },
      }),
    ]);

    return {
      academicYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null,
      totals: {
        students: totalStudents,
        teachers: totalTeachers,
        classes: totalClasses,
        sections: totalSections,
      },
      studentAttendanceToday: {
        ...this.toBreakdown(studentRows),
        date: today,
        totalStudents,
        sectionsMarked: sectionsMarkedRows.length,
        totalSections,
      },
      teacherAttendanceToday: { ...this.toBreakdown(teacherRows), date: today, totalTeachers },
    };
  }

  async getTeacherSummary(userId: number): Promise<TeacherSummaryView> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!teacher) throw new NotFoundException('No teacher profile for this account');

    const today = this.todayUtcDate();
    const [assignments, classTeacherSections, myAttendance] = await Promise.all([
      this.prisma.teacherClassSubject.findMany({
        where: { teacherId: teacher.id },
        include: { class: true, section: true, subject: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.section.findMany({
        where: { classTeacherId: teacher.id },
        include: { class: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.teacherAttendance.findUnique({
        where: { teacherId_date: { teacherId: teacher.id, date: new Date(today) } },
      }),
    ]);

    const classTeacherSectionIds = new Set(classTeacherSections.map((s) => s.id));
    const classes: TeacherClassView[] = assignments.map((a) => ({
      class: { id: a.class.id, name: a.class.name },
      section: { id: a.section.id, name: a.section.name },
      subject: { id: a.subject.id, name: a.subject.name },
      isClassTeacher: classTeacherSectionIds.has(a.sectionId),
    }));
    // A class-teacher section with zero subject assignments still needs to show up.
    const coveredSectionIds = new Set(assignments.map((a) => a.sectionId));
    for (const section of classTeacherSections) {
      if (!coveredSectionIds.has(section.id)) {
        classes.push({
          class: { id: section.class.id, name: section.class.name },
          section: { id: section.id, name: section.name },
          subject: null,
          isClassTeacher: true,
        });
      }
    }

    const markedTodayRows = classTeacherSections.length
      ? await this.prisma.studentAttendance.findMany({
          where: { date: new Date(today), sectionId: { in: [...classTeacherSectionIds] } },
          select: { sectionId: true },
          distinct: ['sectionId'],
        })
      : [];
    const markedTodaySectionIds = new Set(markedTodayRows.map((r) => r.sectionId));

    return {
      teacher: { id: teacher.id, name: teacher.user.name },
      classes,
      classTeacherOf: classTeacherSections.map((s) => ({
        class: { id: s.class.id, name: s.class.name },
        section: { id: s.id, name: s.name },
        attendanceMarkedToday: markedTodaySectionIds.has(s.id),
      })),
      myAttendanceToday: myAttendance ? { status: myAttendance.status } : null,
    };
  }

  async getStudentSummary(userId: number): Promise<StudentSummaryView> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { class: true, section: true },
    });
    if (!student) throw new NotFoundException('No student profile for this account');

    const today = this.todayUtcDate();
    const monthStart = `${today.slice(0, 7)}-01`;

    const [myAttendanceToday, monthRows, upcoming] = await Promise.all([
      this.prisma.studentAttendance.findUnique({
        where: { studentId_date: { studentId: student.id, date: new Date(today) } },
      }),
      this.prisma.studentAttendance.groupBy({
        by: ['status'],
        where: { studentId: student.id, date: { gte: new Date(monthStart), lte: new Date(today) } },
        _count: { _all: true },
      }),
      this.prisma.assignment.findMany({
        where: {
          classId: student.classId,
          sectionId: student.sectionId,
          dueDate: { gte: new Date(today) },
        },
        include: { subject: true },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    const breakdown = this.toBreakdown(monthRows);

    return {
      student: {
        id: student.id,
        name: student.name,
        admissionNo: student.admissionNo,
        class: { id: student.class.id, name: student.class.name },
        section: { id: student.section.id, name: student.section.name },
      },
      myAttendanceToday: myAttendanceToday ? { status: myAttendanceToday.status } : null,
      attendanceThisMonth: {
        present: breakdown.present,
        totalMarked: breakdown.totalMarked,
        presentPercent: breakdown.presentPercent,
      },
      upcomingAssignments: upcoming.map((a) => ({
        id: a.id,
        title: a.title,
        subject: { id: a.subject.id, name: a.subject.name },
        dueDate: a.dueDate,
      })),
    };
  }

  private toBreakdown(
    rows: Array<{ status: AttendanceStatus; _count: { _all: number } }>,
  ): AttendanceBreakdown {
    const breakdown = { ...EMPTY_BREAKDOWN };
    for (const row of rows) {
      const count = row._count._all;
      breakdown.totalMarked += count;
      if (row.status === 'PRESENT') breakdown.present = count;
      else if (row.status === 'ABSENT') breakdown.absent = count;
      else if (row.status === 'LATE') breakdown.late = count;
      else if (row.status === 'LEAVE') breakdown.leave = count;
    }
    breakdown.presentPercent =
      breakdown.totalMarked === 0
        ? null
        : Math.round((breakdown.present / breakdown.totalMarked) * 100);
    return breakdown;
  }

  private todayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
