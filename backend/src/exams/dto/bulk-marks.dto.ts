import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

// Only students the teacher actually touched belong in `records` — same
// "no default value, only what was explicitly entered" rule the attendance
// bulk-mark endpoint follows. A student left out simply stays unmarked.
export class ExamMarkRecordDto {
  @Type(() => Number)
  @IsInt()
  studentId!: number;

  // Required unless isAbsent — validated in the service against the exam
  // subject's maxMarks, not here (that number isn't known at the DTO level).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;
}

export class BulkMarksDto {
  @Type(() => Number)
  @IsInt()
  subjectId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamMarkRecordDto)
  records!: ExamMarkRecordDto[];
}
