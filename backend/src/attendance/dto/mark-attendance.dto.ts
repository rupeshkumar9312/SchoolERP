import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  ValidateNested,
} from 'class-validator';

export class AttendanceRecordDto {
  @Type(() => Number)
  @IsInt()
  studentId!: number;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class MarkAttendanceDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}
