import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class ListAssignmentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;

  /** Admin-tier filter only — a TEACHER caller is always scoped to their own
   * assignments regardless of this value; see AssignmentsService.findAll(). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacherId?: number;
}
