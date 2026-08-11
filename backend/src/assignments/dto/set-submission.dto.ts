import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetSubmissionDto {
  @IsBoolean()
  submitted!: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}
