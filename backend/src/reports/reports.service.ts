import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceSummaryQueryDto,
  DefaultersQueryDto,
  StaffAttendanceSummaryQueryDto,
} from './dto/report-queries.dto';

const DEFAULT_THRESHOLD = 75;

interface Counts {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  percent: number | null;
}

export interface StudentAttendanceRow extends Counts {
  student: { id: number; admissionNo: string | null; name: string };
  class: { id: number; name: string };
  section: { id: number; name: string };
}

export interface ClassAttendanceRow extends Counts {
  class: { id: number; name: string };
  studentCount: number;
}

export interface AttendanceSummaryView {
  range: { from: string; to: string };
  classSummaries: ClassAttendanceRow[];
  students: StudentAttendanceRow[];
}

export interface DefaultersView {
  range: { from: string; to: string };
  threshold: number;
  defaulters: StudentAttendanceRow[];
}

export interface TeacherAttendanceRow extends Counts {
  teacher: { id: number; name: string };
}

export interface StaffAttendanceSummaryView {
  range: { from: string; to: string };
  teachers: TeacherAttendanceRow[];
}

function emptyCounts(): Counts {
  return { present: 0, absent: 0, late: 0, leave: 0, totalMarked: 0, percent: null };
}

function tally(counts: Counts, status: AttendanceStatus): void {
  counts.totalMarked++;
  if (status === 'PRESENT') counts.present++;
  else if (status === 'ABSENT') counts.absent++;
  else if (status === 'LATE') counts.late++;
  else if (status === 'LEAVE') counts.leave++;
}

function finalizePercent(counts: Counts): void {
  counts.percent =
    counts.totalMarked === 0 ? null : Math.round((counts.present / counts.totalMarked) * 100);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttendanceSummary(query: AttendanceSummaryQueryDto): Promise<AttendanceSummaryView> {
    const { from, to } = this.resolveRange(query.from, query.to);
    const holidayDates = await this.holidayDates(from, to);

    const rows = await this.prisma.studentAttendance.findMany({
      where: {
        date: { gte: from, lte: to, notIn: holidayDates },
        classId: query.classId,
        sectionId: query.sectionId,
      },
      include: { student: true, class: true, section: true },
    });

    const perStudent = new Map<
      number,
      Counts & {
        student: { id: number; admissionNo: string | null; name: string };
        class: { id: number; name: string };
        section: { id: number; name: string };
      }
    >();
    for (const row of rows) {
      let entry = perStudent.get(row.studentId);
      if (!entry) {
        entry = {
          ...emptyCounts(),
          student: {
            id: row.student.id,
            admissionNo: row.student.admissionNo,
            name: row.student.name,
          },
          class: { id: row.class.id, name: row.class.name },
          section: { id: row.section.id, name: row.section.name },
        };
        perStudent.set(row.studentId, entry);
      }
      tally(entry, row.status);
    }

    const students: StudentAttendanceRow[] = [...perStudent.values()]
      .map((entry) => {
        finalizePercent(entry);
        return entry;
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name));

    const perClass = new Map<
      number,
      Counts & { class: { id: number; name: string }; studentCount: number }
    >();
    for (const s of students) {
      let entry = perClass.get(s.class.id);
      if (!entry) {
        entry = { ...emptyCounts(), class: s.class, studentCount: 0 };
        perClass.set(s.class.id, entry);
      }
      entry.present += s.present;
      entry.absent += s.absent;
      entry.late += s.late;
      entry.leave += s.leave;
      entry.totalMarked += s.totalMarked;
      entry.studentCount++;
    }

    const classSummaries: ClassAttendanceRow[] = [...perClass.values()]
      .map((entry) => {
        finalizePercent(entry);
        return entry;
      })
      .sort((a, b) => a.class.name.localeCompare(b.class.name));

    return { range: { from: toIsoDate(from), to: toIsoDate(to) }, classSummaries, students };
  }

  async getDefaulters(query: DefaultersQueryDto): Promise<DefaultersView> {
    const threshold = query.threshold ?? DEFAULT_THRESHOLD;
    const summary = await this.getAttendanceSummary({
      classId: query.classId,
      sectionId: query.sectionId,
      from: query.from,
      to: query.to,
    });

    const defaulters = summary.students
      .filter((s) => s.totalMarked > 0 && s.percent !== null && s.percent < threshold)
      .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));

    return { range: summary.range, threshold, defaulters };
  }

  async getStaffAttendanceSummary(
    query: StaffAttendanceSummaryQueryDto,
  ): Promise<StaffAttendanceSummaryView> {
    const { from, to } = this.resolveRange(query.from, query.to);
    const holidayDates = await this.holidayDates(from, to);

    const rows = await this.prisma.teacherAttendance.findMany({
      where: {
        date: { gte: from, lte: to, notIn: holidayDates },
        teacherId: query.teacherId,
      },
      include: { teacher: { include: { user: true } } },
    });

    const perTeacher = new Map<number, Counts & { teacher: { id: number; name: string } }>();
    for (const row of rows) {
      let entry = perTeacher.get(row.teacherId);
      if (!entry) {
        entry = { ...emptyCounts(), teacher: { id: row.teacher.id, name: row.teacher.user.name } };
        perTeacher.set(row.teacherId, entry);
      }
      tally(entry, row.status);
    }

    const teachers: TeacherAttendanceRow[] = [...perTeacher.values()]
      .map((entry) => {
        finalizePercent(entry);
        return entry;
      })
      .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));

    return { range: { from: toIsoDate(from), to: toIsoDate(to) }, teachers };
  }

  private async holidayDates(from: Date, to: Date): Promise<Date[]> {
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true },
    });
    return rows.map((r) => r.date);
  }

  /** Both ends default to the current UTC calendar month — matches the rest of
   * the app's UTC-based date convention (see AttendanceService/todayUtcDate). */
  private resolveRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const defaultFrom = new Date(Date.UTC(year, month, 1));
    const defaultTo = new Date(Date.UTC(year, month + 1, 0));

    return {
      from: fromStr ? new Date(fromStr) : defaultFrom,
      to: toStr ? new Date(toStr) : defaultTo,
    };
  }
}
