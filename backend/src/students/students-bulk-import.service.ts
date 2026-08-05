import { BadRequestException, Injectable } from '@nestjs/common';
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

const REQUIRED_KEYS: ColumnKey[] = ['admissionNo', 'name', 'class', 'section'];

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

@Injectable()
export class StudentsBulkImportService {
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

  async bulkImport(fileBuffer: Buffer): Promise<BulkImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's bundled Buffer type predates @types/node's generic Buffer<T>,
      // so TS sees a structural mismatch here even though it's the same Buffer at runtime.
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
        'No current academic year is set. Set one under Academic Setup before importing students.',
      );
    }

    const classes = await this.prisma.class.findMany({
      where: { academicYearId: currentYear.id },
      include: { sections: true },
    });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

    const failures: BulkImportFailure[] = [];
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
      const admissionNo = cellToString(cellValues.get('admissionNo')) ?? '';
      const name = cellToString(cellValues.get('name')) ?? '';
      const className = cellToString(cellValues.get('class')) ?? '';
      const sectionName = cellToString(cellValues.get('section')) ?? '';

      const recordFailure = (error: string) => {
        failures.push({ row: rowNumber, admissionNo, name, error });
        rawRowsForFailures.push([
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

      const dto = plainToInstance(CreateStudentDto, {
        admissionNo,
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
        await this.students.create(dto);
        successCount++;
      } catch (error) {
        recordFailure(error instanceof Error ? error.message : 'Failed to create student');
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
        col.width = 20;
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
