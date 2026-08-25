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

// The exam's first class sitting — optional so a bare "name + type" umbrella
// can be created with no class scheduled yet, but in practice the web form
// always sends this alongside the umbrella fields so single-class creation
// stays a one-step flow. Shape matches CreateExamScheduleDto exactly (see
// that file) since this is the same "schedule a class" operation, just
// inlined into the umbrella-create request.
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
