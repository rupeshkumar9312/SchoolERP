import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
