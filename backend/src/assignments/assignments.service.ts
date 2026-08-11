import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Teacher } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';
import { SetSubmissionDto } from './dto/set-submission.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

export interface AssignmentView {
  id: number;
  title: string;
  description: string | null;
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string };
  teacher: { id: number; name: string };
  dueDate: Date;
  /** Shared by every occurrence of a recurring-weekly creation; null for a one-off. */
  seriesId: string | null;
  attachment: { fileName: string; mimeType: string; size: number } | null;
  submittedCount: number;
  totalStudents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionView {
  student: { id: number; name: string; admissionNo: string };
  submitted: boolean;
  submittedAt: Date | null;
  remarks: string | null;
}

export interface AttachmentForDownload {
  path: string;
  fileName: string;
  mimeType: string;
}

type AssignmentWithRefs = Prisma.AssignmentGetPayload<{
  include: { class: true; section: true; subject: true; teacher: { include: { user: true } } };
}>;

const ASSIGNMENT_INCLUDE = {
  class: true,
  section: true,
  subject: true,
  teacher: { include: { user: true } },
} as const;

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'assignments');
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);
const MAX_WEEKLY_OCCURRENCES = 52;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Admin-tier roles see everything (optionally filtered); a TEACHER only ever
   * sees their own — the `teacherId` query filter is ignored for them so a
   * client can't request someone else's list by guessing an id. */
  async findAll(
    query: ListAssignmentsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<AssignmentView[]> {
    const where: Prisma.AssignmentWhereInput = {
      classId: query.classId,
      sectionId: query.sectionId,
      subjectId: query.subjectId,
    };

    if (actor.roleName === TEACHER_ROLE) {
      const teacher = await this.getOwnTeacher(actor.id);
      where.teacherId = teacher.id;
    } else if (query.teacherId !== undefined) {
      where.teacherId = query.teacherId;
    }

    const rows = await this.prisma.assignment.findMany({
      where,
      include: ASSIGNMENT_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async findOne(id: number, actor: AuthenticatedUser): Promise<AssignmentView> {
    const row = await this.findRowOrThrow(id);
    await this.assertMayView(row, actor);
    return this.toView(row);
  }

  async create(dto: CreateAssignmentDto, actor: AuthenticatedUser): Promise<AssignmentView> {
    if (actor.roleName !== TEACHER_ROLE) {
      throw new ForbiddenException('Only a teacher may create an assignment');
    }
    const teacher = await this.getOwnTeacher(actor.id);
    await this.assertAssignedToTeach(teacher.id, dto.classId, dto.sectionId, dto.subjectId);

    const dueDates = this.resolveDueDates(dto.dueDate, dto.repeatWeeklyUntil);
    const seriesId = dueDates.length > 1 ? randomUUID() : null;

    try {
      const rows = await this.prisma.$transaction(
        dueDates.map((dueDate) =>
          this.prisma.assignment.create({
            data: {
              title: dto.title,
              description: dto.description,
              classId: dto.classId,
              sectionId: dto.sectionId,
              subjectId: dto.subjectId,
              teacherId: teacher.id,
              dueDate,
              seriesId,
            },
            include: ASSIGNMENT_INCLUDE,
          }),
        ),
      );

      await Promise.all(
        rows.map((row) =>
          this.audit.record({
            entityType: 'Assignment',
            entityId: row.id,
            action: 'CREATE',
            userId: actor.id,
            newValues: row,
          }),
        ),
      );

      return this.toView(rows[0]);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /** Only the owning teacher may edit — not even an admin, per spec: admins
   * are read-only for assignments. */
  async update(
    id: number,
    dto: UpdateAssignmentDto,
    actor: AuthenticatedUser,
  ): Promise<AssignmentView> {
    const existing = await this.findRowOrThrow(id);
    await this.assertMayModify(existing, actor);

    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Assignment',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.findRowOrThrow(id);
    await this.assertMayModify(existing, actor);

    if (existing.attachmentPath) {
      await fs.unlink(existing.attachmentPath).catch(() => undefined);
    }

    await this.prisma.assignment.delete({ where: { id } });
    await this.audit.record({
      entityType: 'Assignment',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  // ---- Attachments ----

  async attachFile(
    id: number,
    actor: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<AssignmentView> {
    const existing = await this.findRowOrThrow(id);
    await this.assertMayModify(existing, actor);

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, PNG or JPEG.',
      );
    }

    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = path.join(UPLOAD_ROOT, `${randomUUID()}-${safeName}`);
    await fs.writeFile(fullPath, file.buffer);

    // Replacing an existing attachment — remove the old file from disk once
    // the new one is safely written.
    if (existing.attachmentPath) {
      await fs.unlink(existing.attachmentPath).catch(() => undefined);
    }

    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        attachmentPath: fullPath,
        attachmentFileName: file.originalname,
        attachmentMimeType: file.mimetype,
        attachmentSize: file.size,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Assignment',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  async removeAttachment(id: number, actor: AuthenticatedUser): Promise<AssignmentView> {
    const existing = await this.findRowOrThrow(id);
    await this.assertMayModify(existing, actor);
    if (!existing.attachmentPath) throw new NotFoundException('This assignment has no attachment');

    await fs.unlink(existing.attachmentPath).catch(() => undefined);

    const row = await this.prisma.assignment.update({
      where: { id },
      data: {
        attachmentPath: null,
        attachmentFileName: null,
        attachmentMimeType: null,
        attachmentSize: null,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Assignment',
      entityId: id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  async getAttachmentForDownload(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<AttachmentForDownload> {
    const existing = await this.findRowOrThrow(id);
    await this.assertMayView(existing, actor);
    if (!existing.attachmentPath || !existing.attachmentFileName || !existing.attachmentMimeType) {
      throw new NotFoundException('This assignment has no attachment');
    }
    return {
      path: existing.attachmentPath,
      fileName: existing.attachmentFileName,
      mimeType: existing.attachmentMimeType,
    };
  }

  // ---- Submission tracking ----
  // Staff-recorded, like StudentAttendance — there is no student login for a
  // student to mark their own work submitted.

  async listSubmissions(assignmentId: number, actor: AuthenticatedUser): Promise<SubmissionView[]> {
    const assignment = await this.findRowOrThrow(assignmentId);
    await this.assertMayView(assignment, actor);

    const [students, submissions] = await Promise.all([
      this.prisma.student.findMany({
        where: { classId: assignment.classId, sectionId: assignment.sectionId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.assignmentSubmission.findMany({ where: { assignmentId } }),
    ]);
    const byStudentId = new Map(submissions.map((s) => [s.studentId, s]));

    return students.map((s) => {
      const sub = byStudentId.get(s.id);
      return {
        student: { id: s.id, name: s.name, admissionNo: s.admissionNo },
        submitted: sub?.submitted ?? false,
        submittedAt: sub?.submittedAt ?? null,
        remarks: sub?.remarks ?? null,
      };
    });
  }

  /** Only the owning teacher may record submissions — same ownership rule as edit/delete. */
  async setSubmission(
    assignmentId: number,
    studentId: number,
    dto: SetSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<SubmissionView> {
    const assignment = await this.findRowOrThrow(assignmentId);
    await this.assertMayModify(assignment, actor);

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (
      !student ||
      student.classId !== assignment.classId ||
      student.sectionId !== assignment.sectionId
    ) {
      throw new BadRequestException("That student is not in this assignment's class and section");
    }

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });

    const data = {
      submitted: dto.submitted,
      submittedAt: dto.submitted ? new Date() : null,
      remarks: dto.remarks,
    };
    const row = await this.prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: data,
      create: { assignmentId, studentId, ...data },
    });

    await this.audit.record({
      entityType: 'AssignmentSubmission',
      entityId: row.id,
      action: existing ? 'UPDATE' : 'CREATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });

    return {
      student: { id: student.id, name: student.name, admissionNo: student.admissionNo },
      submitted: row.submitted,
      submittedAt: row.submittedAt,
      remarks: row.remarks,
    };
  }

  // ---- Shared helpers ----

  private async findRowOrThrow(id: number): Promise<AssignmentWithRefs> {
    const row = await this.prisma.assignment.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Assignment not found');
    return row;
  }

  private async getOwnTeacher(userId: number): Promise<Teacher> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('No teacher profile for this account');
    return teacher;
  }

  private async assertMayView(row: AssignmentWithRefs, actor: AuthenticatedUser): Promise<void> {
    if (actor.roleName !== TEACHER_ROLE) return;
    const teacher = await this.getOwnTeacher(actor.id);
    if (row.teacherId !== teacher.id) {
      throw new ForbiddenException('You may only view assignments you created');
    }
  }

  private async assertMayModify(row: AssignmentWithRefs, actor: AuthenticatedUser): Promise<void> {
    if (actor.roleName !== TEACHER_ROLE) {
      throw new ForbiddenException('Only the teacher who created this assignment may modify it');
    }
    const teacher = await this.getOwnTeacher(actor.id);
    if (row.teacherId !== teacher.id) {
      throw new ForbiddenException('You may only modify assignments you created');
    }
  }

  /** A teacher may only set homework for a class+section+subject they're
   * actually assigned to teach (a TeacherClassSubject row) — the same
   * ownership discipline the rest of the app applies to attendance-marking. */
  private async assertAssignedToTeach(
    teacherId: number,
    classId: number,
    sectionId: number,
    subjectId: number,
  ): Promise<void> {
    const assignment = await this.prisma.teacherClassSubject.findFirst({
      where: { teacherId, classId, sectionId, subjectId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to teach this class, section and subject');
    }
  }

  /** A single date for a one-off assignment, or one date per week (capped)
   * when repeatWeeklyUntil is set. */
  private resolveDueDates(dueDate: string, repeatWeeklyUntil?: string): Date[] {
    const start = new Date(dueDate);
    if (!repeatWeeklyUntil) return [start];

    const end = new Date(repeatWeeklyUntil);
    if (end <= start) {
      throw new BadRequestException('"Repeat weekly until" must be after the due date');
    }

    const dates: Date[] = [];
    let cursor = start;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    while (cursor <= end) {
      if (dates.length >= MAX_WEEKLY_OCCURRENCES) {
        throw new BadRequestException(
          `That range would create more than ${MAX_WEEKLY_OCCURRENCES} weekly assignments — narrow the end date.`,
        );
      }
      dates.push(cursor);
      cursor = new Date(cursor.getTime() + oneWeekMs);
    }
    return dates;
  }

  private async toView(row: AssignmentWithRefs): Promise<AssignmentView> {
    const [submittedCount, totalStudents] = await Promise.all([
      this.prisma.assignmentSubmission.count({ where: { assignmentId: row.id, submitted: true } }),
      this.prisma.student.count({
        where: { classId: row.classId, sectionId: row.sectionId, isActive: true },
      }),
    ]);

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      class: { id: row.class.id, name: row.class.name },
      section: { id: row.section.id, name: row.section.name },
      subject: { id: row.subject.id, name: row.subject.name },
      teacher: { id: row.teacher.id, name: row.teacher.user.name },
      dueDate: row.dueDate,
      seriesId: row.seriesId,
      attachment:
        row.attachmentFileName && row.attachmentMimeType && row.attachmentSize !== null
          ? {
              fileName: row.attachmentFileName,
              mimeType: row.attachmentMimeType,
              size: row.attachmentSize,
            }
          : null,
      submittedCount,
      totalStudents,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return new BadRequestException('Unknown classId, sectionId or subjectId');
    }
    return error as Error;
  }
}
