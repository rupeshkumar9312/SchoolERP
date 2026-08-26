import { ExamScheduleStatus, ExamType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

// classId/academicYearId/status filter on the schedules relation — an Exam
// matches if it has at least one ExamSchedule meeting the filter, since
// those fields no longer live on Exam itself.
export class ListExamsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicYearId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;

  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsEnum(ExamScheduleStatus)
  status?: ExamScheduleStatus;
}
