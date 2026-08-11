import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  classId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @Type(() => Number)
  @IsInt()
  subjectId!: number;

  @IsDateString()
  dueDate!: string;

  /** When set, creates one assignment per week from dueDate up to and
   * including this date (all sharing a seriesId) — see
   * AssignmentsService.resolveDueDates() for the occurrence cap. */
  @IsOptional()
  @IsDateString()
  repeatWeeklyUntil?: string;
}
