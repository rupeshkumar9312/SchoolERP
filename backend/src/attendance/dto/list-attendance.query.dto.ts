import { Type } from 'class-transformer';
import { IsDateString, IsInt } from 'class-validator';

export class ListAttendanceQueryDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @IsDateString()
  date!: string;
}
