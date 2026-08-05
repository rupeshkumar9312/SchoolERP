import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class CreateAssignmentDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @Type(() => Number)
  @IsInt()
  subjectId!: number;

  /** If true, also makes this teacher the class (homeroom) teacher of the section. */
  @IsOptional()
  @IsBoolean()
  isClassTeacher?: boolean;
}
