import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentsService } from './students.service';

export interface BulkImportFailure {
  row: number;
  admissionNo: string;
  name: string;
  error: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  failures: BulkImportFailure[];
  /** Base64-encoded .xlsx of the failed rows (with an added Error column), present only when failures exist. */
  failuresWorkbookBase64: string | null;
}

const COLUMNS = [
  {
    key: 'admissionNo',
    header: 'Admission No.',
    synonyms: ['admissionno', 'admissionnumber', 'admno'],
  },
  { key: 'name', header: 'Name', synonyms: ['name', 'studentname', 'fullname'] },
  { key: 'dateOfBirth', header: 'Date of Birth', synonyms: ['dateofbirth', 'dob'] },
  { key: 'gender', header: 'Gender', synonyms: ['gender', 'sex'] },
  { key: 'class', header: 'Class', synonyms: ['class', 'classname', 'grade'] },
  { key: 'section', header: 'Section', synonyms: ['section', 'sectionname'] },
  {
    key: 'guardianName',
    header: 'Guardian Name',
    synonyms: ['guardianname', 'parentname'],
  },
  {
    key: 'guardianPhone',
    header: 'Guardian Phone',
    synonyms: ['guardianphone', 'parentphone', 'phone', 'contactnumber', 'mobile'],
  },
  {
    key: 'guardianEmail',
    header: 'Guardian Email',
    synonyms: ['guardianemail', 'parentemail', 'email'],
  },
  { key: 'address', header: 'Address', synonyms: ['address'] },
  {
    key: 'admissionDate',
    header: 'Admission Date',
    synonyms: ['admissiondate', 'dateofadmission'],
  },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

const REQUIRED_KEYS: ColumnKey[] = ['name', 'class', 'section'];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * exceljs cell values aren't always primitives — rich text, formulas, and
 * hyperlinks come back as objects — so a bare `String(value)` would silently
 * stringify to "[object Object]". This extracts the human-readable text.
 */
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

/** Excel-serial-date-aware coercion to an ISO 'YYYY-MM-DD' string, or undefined if the cell is empty. */
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

const PROGRESS_LOG_EVERY = 50;
/** Each row is a separate DB round trip today (this doesn't touch
 * StudentsService.create() — that stays exactly as every other caller
 * relies on it), so the win here is running several rows' worth of that
 * I/O concurrently instead of fully sequentially, one row finishing before
 * the next starts. Kept modest rather than maximal: the production DB is a
 * remote, unpooled host (no `connection_limit` set), so this isn't tuned
 * to saturate a connection pool that may not exist — just to stop wasting
 * the wall-clock time each row spends waiting on the network. */
const IMPORT_CONCURRENCY = 8;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

@Injectable()
export class StudentsBulkImportService {
  private readonly logger = new Logger(StudentsBulkImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  /** A blank .xlsx admins can fill in — header row only, matching the columns bulkImport() expects. */
  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    sheet.addRow(COLUMNS.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow([
      'A1024',
      'Jane Doe',
      '2015-04-12',
      'Female',
      'Class 1',
      'A',
      'John Doe',
      '9876543210',
      'john.doe@example.com',
      '12 Elm Street',
      '2024-06-01',
    ]);
    sheet.columns.forEach((col) => {
      col.width = 20;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async bulkImport(fileBuffer: Buffer, actorId?: number): Promise<BulkImportResult> {
    const startedAt = Date.now();
    const elapsed = () => `${Date.now() - startedAt}ms`;
    this.logger.log(
      `Bulk import started — ${fileBuffer.length} byte file, actor ${actorId ?? 'unknown'}`,
    );

    try {
      return await this.runImport(fileBuffer, actorId, elapsed);
    } catch (error) {
      // Covers anything the per-row handling below doesn't already catch
      // and convert into a row failure — a bad workbook is its own
      // BadRequestException path above and logs there instead. The point
      // here is specifically the case this whole feature was missing:
      // a crash that used to reach the client (if it reached it at all)
      // as a bare, unexplained failure now leaves one clear line saying
      // what happened and how far the import got before it did.
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Bulk import crashed after ${elapsed()}: ${message}`, stack);
      throw error;
    }
  }

  private async runImport(
    fileBuffer: Buffer,
    actorId: number | undefined,
    elapsed: () => string,
  ): Promise<BulkImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's bundled Buffer type predates @types/node's generic Buffer<T>,
      // so TS sees a structural mismatch here even though it's the same Buffer at runtime.
      await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch (error) {
      this.logger.warn(
        `Bulk import rejected — unreadable workbook: ${error instanceof Error ? error.message : error}`,
      );
      throw new BadRequestException(
        'Could not read that file — please upload a valid .xlsx workbook.',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      this.logger.warn('Bulk import rejected — workbook has no sheets');
      throw new BadRequestException('The workbook has no sheets.');
    }

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
      this.logger.warn(`Bulk import rejected — missing column(s): ${missingHeaders.join(', ')}`);
      throw new BadRequestException(
        `The uploaded file is missing required column(s): ${missingHeaders.join(', ')}. Download the template to see the expected format.`,
      );
    }

    const currentYear = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!currentYear) {
      this.logger.warn('Bulk import rejected — no current academic year set');
      throw new BadRequestException(
        'No current academic year is set. Set one under Academic Setup before importing students.',
      );
    }

    const classes = await this.prisma.class.findMany({
      where: { academicYearId: currentYear.id },
      include: { sections: true },
    });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

    let successCount = 0;
    let totalRows = 0;

    // Rows within a concurrent batch (below) can finish in a different
    // order than they started, so failures are collected paired with their
    // row number and sorted back into order afterward — otherwise the
    // returned list, and the exported failures workbook, could jump
    // around row-number-wise depending on which row happened to finish
    // first.
    const collectedFailures: Array<{ failure: BulkImportFailure; rawRow: unknown[] }> = [];
    // Everything above and in this parsing pass is synchronous/local (no
    // DB, no bcrypt) — the actual per-row cost lives entirely in the
    // validate()+create() step below, which is why only that step needs
    // to be chunked for concurrency; parsing is already effectively free.
    const candidates: Array<{ dto: CreateStudentDto; recordFailure: (error: string) => void }> = [];

    this.logger.log(
      `Bulk import processing up to ${sheet.rowCount - 1} row(s) against academic year "${currentYear.name}"`,
    );

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
      const admissionNo = cellToString(cellValues.get('admissionNo')) ?? '';
      const name = cellToString(cellValues.get('name')) ?? '';
      const className = cellToString(cellValues.get('class')) ?? '';
      const sectionName = cellToString(cellValues.get('section')) ?? '';

      const recordFailure = (error: string) => {
        collectedFailures.push({
          failure: { row: rowNumber, admissionNo, name, error },
          rawRow: [
            admissionNo,
            name,
            cellToString(cellValues.get('dateOfBirth')) ?? '',
            cellToString(cellValues.get('gender')) ?? '',
            className,
            sectionName,
            cellToString(cellValues.get('guardianName')) ?? '',
            cellToString(cellValues.get('guardianPhone')) ?? '',
            cellToString(cellValues.get('guardianEmail')) ?? '',
            cellToString(cellValues.get('address')) ?? '',
            cellToString(cellValues.get('admissionDate')) ?? '',
            error,
          ],
        });
        this.logger.warn(
          `Row ${rowNumber} failed — "${name || admissionNo || 'unnamed'}": ${error}`,
        );
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

      const dto = plainToInstance(CreateStudentDto, {
        // Blank cell -> undefined, not '' — an empty string would be a real
        // value under the column's unique index (unlike NULL, which MySQL
        // allows to repeat), so two blank-admission-number rows would
        // otherwise collide as duplicates.
        admissionNo: admissionNo || undefined,
        name,
        dateOfBirth: cellToDateString(cellValues.get('dateOfBirth')),
        gender: cellToString(cellValues.get('gender')),
        classId: klass.id,
        sectionId: section.id,
        guardianName: cellToString(cellValues.get('guardianName')),
        guardianPhone: cellToString(cellValues.get('guardianPhone')),
        guardianEmail: cellToString(cellValues.get('guardianEmail')),
        address: cellToString(cellValues.get('address')),
        admissionDate: cellToDateString(cellValues.get('admissionDate')),
      });

      candidates.push({ dto, recordFailure });
    }

    this.logger.log(
      `Bulk import validating/creating ${candidates.length} candidate row(s), ${IMPORT_CONCURRENCY} at a time`,
    );

    let processed = 0;
    let lastLoggedAt = 0;
    for (const batch of chunk(candidates, IMPORT_CONCURRENCY)) {
      await Promise.all(
        batch.map(async ({ dto, recordFailure }) => {
          const validationErrors = await validate(dto);
          if (validationErrors.length > 0) {
            const message = validationErrors
              .map((e) => Object.values(e.constraints ?? {}).join(', '))
              .filter(Boolean)
              .join('; ');
            recordFailure(message || 'Invalid row data');
            return;
          }

          try {
            await this.students.create(dto, actorId);
            successCount++;
          } catch (error) {
            recordFailure(error instanceof Error ? error.message : 'Failed to create student');
          }
        }),
      );

      // The single highest-value line in this whole method: if the process
      // gets killed mid-import (a platform execution-time ceiling is the
      // usual suspect for "large file, no error"), this is the last thing
      // that made it to the log — so it says exactly how far the import
      // got and how long that took, instead of nothing at all.
      processed += batch.length;
      if (processed - lastLoggedAt >= PROGRESS_LOG_EVERY || processed === candidates.length) {
        lastLoggedAt = processed;
        this.logger.log(
          `Bulk import progress — ${processed}/${candidates.length} candidate row(s) processed (${successCount} ok, ${collectedFailures.length} failed), ${elapsed()} elapsed`,
        );
      }
    }

    // Concurrent rows can resolve out of order — sorted back into row order
    // so the returned list (and the exported workbook below) reads top to
    // bottom the same way the source file did.
    collectedFailures.sort((a, b) => a.failure.row - b.failure.row);
    const failures = collectedFailures.map((f) => f.failure);

    let failuresWorkbookBase64: string | null = null;
    if (collectedFailures.length > 0) {
      const failureWorkbook = new ExcelJS.Workbook();
      const failureSheet = failureWorkbook.addWorksheet('Failed rows');
      failureSheet.addRow([...COLUMNS.map((c) => c.header), 'Error']);
      failureSheet.getRow(1).font = { bold: true };
      for (const { rawRow } of collectedFailures) failureSheet.addRow(rawRow);
      failureSheet.columns.forEach((col) => {
        col.width = 20;
      });
      const buffer = await failureWorkbook.xlsx.writeBuffer();
      failuresWorkbookBase64 = Buffer.from(buffer).toString('base64');
    }

    this.logger.log(
      `Bulk import finished — ${totalRows} row(s), ${successCount} succeeded, ${failures.length} failed, ${elapsed()} elapsed`,
    );

    return {
      totalRows,
      successCount,
      failureCount: failures.length,
      failures,
      failuresWorkbookBase64,
    };
  }
}
