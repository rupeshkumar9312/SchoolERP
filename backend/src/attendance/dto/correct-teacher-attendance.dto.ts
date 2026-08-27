import { IsDateString, IsOptional, ValidateIf } from 'class-validator';

/**
 * Admin-only correction of a teacher's recorded check-in / check-out times for
 * a missed or wrong scan (PATCH /attendance/teachers/:id). Omit a field to
 * leave it; send `null` to clear it; send an ISO datetime to set it.
 */
export class CorrectTeacherAttendanceDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  checkInAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  checkOutAt?: string | null;
}
