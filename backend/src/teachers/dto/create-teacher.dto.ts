import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/** No email/password here — both are auto-generated (see TeachersService.create()):
 * email is `{edvanceId}@teacher.edvance.edu`, password via
 * generateTempPassword(). Returned once in the create response's `login` field. */
export class CreateTeacherDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsDateString()
  joiningDate!: string;
}
