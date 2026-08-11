import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

export interface AssignmentBulkImportFailure {
  row: number;
  title: string;
  error: string;
}

export interface AssignmentBulkImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  failures: AssignmentBulkImportFailure[];
  /** Base64-encoded .xlsx of the failed rows (with an added Error column), present only when failures exist. */
  failuresWorkbookBase64: string | null;
}

const COLUMNS = [
  { key: 'title', header: 'Title', synonyms: ['title'] },
  { key: 'description', header: 'Description', synonyms: ['description'] },
  { key: 'class', header: 'Class', synonyms: ['class', 'classname', 'grade'] },
  { key: 'section', header: 'Section', synonyms: ['section', 'sectionname'] },
  { key: 'subject', header: 'Subject', synonyms: ['subject', 'subjectname'] },
  { key: 'dueDate', header: 'Due Date', synonyms: ['duedate', 'due'] },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

const REQUIRED_KEYS: ColumnKey[] = ['title', 'class', 'section', 'subject', 'dueDate'];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** See StudentsBulkImportService — exceljs cells aren't always primitives. */
function cellValueToRawString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => (typeof r.text === 'string' ? r.text : '')).join('');
    }
    if (typeof obj.result === 'string' || typeof obj.result === 'number') return String(obj.result);
  }
  return '';
}

function cellToDateString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = cellValueToRawString(value).trim();
  return str === '' ? undefined : str;
}

function cellToString(value: unknown): string | undefined {
  const str = cellValueToRawString(value).trim();
  return str === '' ? undefined : str;
}

@Injectable()
export class AssignmentsBulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
  ) {}

  /** A blank .xlsx a teacher can fill in — header row only. */
  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Assignments');
    sheet.addRow(COLUMNS.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow([
      'Chapter 3 exercises',
      'Solve questions 1 through 10',
      'Class 1',
      'A',
      'Mathematics',
      '2026-12-15',
    ]);
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Every row goes through AssignmentsService.create(), so it gets the exact
   * same role + "assigned to teach this class/section/subject" checks (and
   * audit logging) as a single manual creation — no separate authorization
   * logic to keep in sync here. */
  async bulkImport(
    fileBuffer: Buffer,
    actor: AuthenticatedUser,
  ): Promise<AssignmentBulkImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new BadRequestException(
        'Could not read that file — please upload a valid .xlsx workbook.',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no sheets.');

    const headerRow = sheet.getRow(1);
    const columnIndexByKey = new Map<ColumnKey, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const normalized = normalizeHeader(cellValueToRawString(cell.value));
      const match = COLUMNS.find((c) => (c.synonyms as readonly string[]).includes(normalized));
      if (match) columnIndexByKey.set(match.key, colNumber);
    });

    const missing = REQUIRED_KEYS.filter((k) => !columnIndexByKey.has(k));
    if (missing.length > 0) {
      const missingHeaders = missing.map((k) => COLUMNS.find((c) => c.key === k)!.header);
      throw new BadRequestException(
        `The uploaded file is missing required column(s): ${missingHeaders.join(', ')}. Download the template to see the expected format.`,
      );
    }

    const currentYear = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!currentYear) {
      throw new BadRequestException(
        'No current academic year is set. Set one under Academic Setup before importing assignments.',
      );
    }

    const classes = await this.prisma.class.findMany({
      where: { academicYearId: currentYear.id },
      include: { sections: true, subjects: true },
    });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

    const failures: AssignmentBulkImportFailure[] = [];
    let successCount = 0;
    let totalRows = 0;
    const rawRowsForFailures: unknown[][] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const cellValues = new Map<ColumnKey, unknown>();
      let isBlank = true;
      for (const [key, colIndex] of columnIndexByKey) {
        const value = row.getCell(colIndex).value;
        if (cellValueToRawString(value).trim() !== '') isBlank = false;
        cellValues.set(key, value);
      }
      if (isBlank) continue;

      totalRows++;
      const title = cellToString(cellValues.get('title')) ?? '';
      const className = cellToString(cellValues.get('class')) ?? '';
      const sectionName = cellToString(cellValues.get('section')) ?? '';
      const subjectName = cellToString(cellValues.get('subject')) ?? '';
      const description = cellToString(cellValues.get('description'));
      const dueDate = cellToDateString(cellValues.get('dueDate')) ?? '';

      const recordFailure = (error: string) => {
        failures.push({ row: rowNumber, title, error });
        rawRowsForFailures.push([
          title,
          description ?? '',
          className,
          sectionName,
          subjectName,
          dueDate,
          error,
        ]);
      };

      const klass = classByName.get(className.trim().toLowerCase());
      if (!klass) {
        recordFailure(`Unknown class "${className}" for academic year ${currentYear.name}`);
        continue;
      }
      const section = klass.sections.find(
        (s) => s.name.trim().toLowerCase() === sectionName.trim().toLowerCase(),
      );
      if (!section) {
        recordFailure(`Unknown section "${sectionName}" in class "${klass.name}"`);
        continue;
      }
      const subject = klass.subjects.find(
        (s) => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase(),
      );
      if (!subject) {
        recordFailure(`Unknown subject "${subjectName}" in class "${klass.name}"`);
        continue;
      }

      const dto = plainToInstance(CreateAssignmentDto, {
        title,
        description,
        classId: klass.id,
        sectionId: section.id,
        subjectId: subject.id,
        dueDate,
      });

      const validationErrors = await validate(dto);
      if (validationErrors.length > 0) {
        const message = validationErrors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .filter(Boolean)
          .join('; ');
        recordFailure(message || 'Invalid row data');
        continue;
      }

      try {
        await this.assignments.create(dto, actor);
        successCount++;
      } catch (error) {
        recordFailure(error instanceof Error ? error.message : 'Failed to create assignment');
      }
    }

    let failuresWorkbookBase64: string | null = null;
    if (failures.length > 0) {
      const failureWorkbook = new ExcelJS.Workbook();
      const failureSheet = failureWorkbook.addWorksheet('Failed rows');
      failureSheet.addRow([...COLUMNS.map((c) => c.header), 'Error']);
      failureSheet.getRow(1).font = { bold: true };
      for (const row of rawRowsForFailures) failureSheet.addRow(row);
      failureSheet.columns.forEach((col) => {
        col.width = 22;
      });
      const buffer = await failureWorkbook.xlsx.writeBuffer();
      failuresWorkbookBase64 = Buffer.from(buffer).toString('base64');
    }

    return {
      totalRows,
      successCount,
      failureCount: failures.length,
      failures,
      failuresWorkbookBase64,
    };
  }
}
