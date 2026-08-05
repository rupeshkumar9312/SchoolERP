import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  classId!: number;
}

export class UpdateSectionDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ListSectionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;
}
