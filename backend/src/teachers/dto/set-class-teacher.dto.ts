import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class SetClassTeacherDto {
  @Type(() => Number)
  @IsInt()
  sectionId!: number;
}
