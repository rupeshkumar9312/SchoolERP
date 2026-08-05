import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';

export class MarkTeacherAttendanceDto {
  /** Omitted for a self-mark; required when an admin marks for another teacher. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teacherId?: number;

  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
