import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ListTeacherAttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  /** Ignored for a plain TEACHER — the service always scopes them to their own row. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacherId?: number;
}
