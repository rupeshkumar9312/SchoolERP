import { ExamType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExamSubjectInputDto {
  @Type(() => Number)
  @IsInt()
  subjectId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMarks!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}

// The exam's first class sitting — optional, since the web form lets an
// admin create a bare "name + type" umbrella with no class scheduled yet
// and add classes afterwards via POST /exams/:id/schedules. When the form
// does pick a class up front, this saves that extra round-trip by creating
// the Exam and its first ExamSchedule together in one request. Shape
// matches CreateExamScheduleDto exactly (see that file) since this is the
// same "schedule a class" operation, just inlined into the umbrella-create
// request.
export class CreateExamScheduleInputDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one subject' })
  @ValidateNested({ each: true })
  @Type(() => ExamSubjectInputDto)
  subjects!: ExamSubjectInputDto[];
}

export class CreateExamDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ExamType)
  type!: ExamType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateExamScheduleInputDto)
  schedule?: CreateExamScheduleInputDto;
}
