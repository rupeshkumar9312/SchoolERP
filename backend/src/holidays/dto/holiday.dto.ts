import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

export class ListHolidaysQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
