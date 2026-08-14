import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/** email/edvanceId are immutable once generated at create time. */
export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
