import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceSummaryQueryDto,
  DefaultersQueryDto,
  StaffAttendanceSummaryQueryDto,
} from './dto/report-queries.dto';

const DEFAULT_THRESHOLD = 75;
/** Nothing in these DTOs previously stopped a caller requesting a
 * multi-year range — that's an unbounded aggregation over the whole
 * attendance table. A year plus a little slack covers every legitimate
 * "whole academic year" report. */
const MAX_RANGE_DAYS = 366;

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

function tallyCount(counts: Counts, status: AttendanceStatus, count: number): void {
  counts.totalMarked += count;
  if (status === 'PRESENT') counts.present += count;
  else if (status === 'ABSENT') counts.absent += count;
  else if (status === 'LATE') counts.late += count;
  else if (status === 'LEAVE') counts.leave += count;
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

  /** Aggregates in SQL via groupBy — one (studentId, status, classId,
   * sectionId) row per combination that actually occurred, instead of
   * fetching every attendance row in the range and tallying them in JS.
   * classId/sectionId ride along in the group key because StudentAttendance
   * snapshots a student's class/section as of the day it was marked (see
   * the schema comment on StudentAttendance) — a student who changed
   * section mid-range keeps each period's real section here, same as the
   * row-by-row version this replaces. */
  async getAttendanceSummary(query: AttendanceSummaryQueryDto): Promise<AttendanceSummaryView> {
    const { from, to } = this.resolveRange(query.from, query.to);
    const holidayDates = await this.holidayDates(from, to);

    const statusRows = await this.prisma.studentAttendance.groupBy({
      by: ['studentId', 'status', 'classId', 'sectionId'],
      where: {
        date: { gte: from, lte: to, notIn: holidayDates },
        classId: query.classId,
        sectionId: query.sectionId,
      },
      _count: { _all: true },
    });

    const studentIds = [...new Set(statusRows.map((r) => r.studentId))];
    const classIds = [...new Set(statusRows.map((r) => r.classId))];
    const sectionIds = [...new Set(statusRows.map((r) => r.sectionId))];
    const [studentRows, classRows, sectionRows] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, admissionNo: true },
      }),
      this.prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      }),
      this.prisma.section.findMany({
        where: { id: { in: sectionIds } },
        select: { id: true, name: true },
      }),
    ]);
    const studentById = new Map(studentRows.map((s) => [s.id, s]));
    const classById = new Map(classRows.map((c) => [c.id, c]));
    const sectionById = new Map(sectionRows.map((s) => [s.id, s]));

    const perStudent = new Map<
      number,
      Counts & {
        student: { id: number; admissionNo: string | null; name: string };
        class: { id: number; name: string };
        section: { id: number; name: string };
      }
    >();
    for (const row of statusRows) {
      let entry = perStudent.get(row.studentId);
      if (!entry) {
        const student = studentById.get(row.studentId);
        const klass = classById.get(row.classId);
        const section = sectionById.get(row.sectionId);
        if (!student || !klass || !section) continue;
        entry = { ...emptyCounts(), student, class: klass, section };
        perStudent.set(row.studentId, entry);
      }
      tallyCount(entry, row.status, row._count._all);
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

    const statusRows = await this.prisma.teacherAttendance.groupBy({
      by: ['teacherId', 'status'],
      where: {
        date: { gte: from, lte: to, notIn: holidayDates },
        teacherId: query.teacherId,
      },
      _count: { _all: true },
    });

    const teacherIds = [...new Set(statusRows.map((r) => r.teacherId))];
    const teacherRows = await this.prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, user: { select: { name: true } } },
    });
    const teacherById = new Map(teacherRows.map((t) => [t.id, { id: t.id, name: t.user.name }]));

    const perTeacher = new Map<number, Counts & { teacher: { id: number; name: string } }>();
    for (const row of statusRows) {
      let entry = perTeacher.get(row.teacherId);
      if (!entry) {
        const teacher = teacherById.get(row.teacherId);
        if (!teacher) continue;
        entry = { ...emptyCounts(), teacher };
        perTeacher.set(row.teacherId, entry);
      }
      tallyCount(entry, row.status, row._count._all);
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

    const from = fromStr ? new Date(fromStr) : defaultFrom;
    const to = toStr ? new Date(toStr) : defaultTo;

    const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }

    return { from, to };
  }
}
