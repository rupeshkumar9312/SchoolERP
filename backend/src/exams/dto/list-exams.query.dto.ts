import { ExamStatus, ExamType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

export class ListExamsQueryDto {
  // Filters via class.academicYearId — Exam has no academicYearId column of
  // its own (see the schema comment on Exam).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicYearId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;

  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;
}
