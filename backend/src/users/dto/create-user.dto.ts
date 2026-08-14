import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

/** No email/password here — both are auto-generated (see UsersService.create()):
 * email is derived from `name` (fullname@admin.edvance.edu, with a numeric
 * suffix on collision), password via generateTempPassword(). Returned once
 * in the create response's `login` field. */
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @Type(() => Number)
  @IsInt()
  roleId!: number;
}
