import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ListAttendanceQueryDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  // Exact-day lookup — used by the mark-attendance flows to pre-fill today's
  // roster. Mutually exclusive with from/to in practice, though the service
  // just prefers `date` if both are somehow present.
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
