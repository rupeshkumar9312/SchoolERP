import { IsDateString, IsOptional } from 'class-validator';

// classId is deliberately not editable — "move" a schedule to a different
// class means delete+recreate, same rule the rest of this module applies to
// identity fields. The subject list is managed separately via the subjects
// sub-resource routes.
export class UpdateExamScheduleDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
