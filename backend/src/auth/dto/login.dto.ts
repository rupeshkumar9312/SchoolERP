import { IsString, MinLength } from 'class-validator';

/** Field is still called `email` on the wire (every caller — web, mobile —
 * already sends that key) but now accepts either a real login email or its
 * short alias (e.g. 'tch000123'); AuthService.login() tries both. Not
 * `@IsEmail()` any more since an alias isn't email-shaped. */
export class LoginDto {
  @IsString()
  @MinLength(1)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
