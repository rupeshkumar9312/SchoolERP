import { ExamType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

// Umbrella-level fields only — name/type. Dates/class/status all live on
// ExamSchedule now; see UpdateExamScheduleDto.
export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;
}
