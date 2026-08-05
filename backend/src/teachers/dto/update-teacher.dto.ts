import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
