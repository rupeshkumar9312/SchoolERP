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

export class CreateExamDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ExamType)
  type!: ExamType;

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
