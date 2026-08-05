import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  classId!: number;
}

export class UpdateSubjectDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ListSubjectsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;
}
