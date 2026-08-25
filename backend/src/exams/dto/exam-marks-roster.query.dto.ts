import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class ExamMarksRosterQueryDto {
  @Type(() => Number)
  @IsInt()
  subjectId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;
}
