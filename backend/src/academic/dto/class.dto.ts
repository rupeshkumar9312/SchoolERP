import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  academicYearId!: number;
}

export class UpdateClassDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ListClassesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicYearId?: number;
}
