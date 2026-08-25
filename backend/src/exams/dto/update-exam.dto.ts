import { ExamType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

// classId is deliberately not editable — "move" an exam to a different class
// means delete+recreate, same rule Assignments applies to classId/sectionId/
// subjectId. The subject list is managed separately via the subjects
// sub-resource routes, not through this DTO.
export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
