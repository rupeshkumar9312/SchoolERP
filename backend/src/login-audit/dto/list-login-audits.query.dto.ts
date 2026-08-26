import { LoginEventType, LoginPlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class ListLoginAuditsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsEnum(LoginEventType)
  event?: LoginEventType;

  @IsOptional()
  @IsEnum(LoginPlatform)
  platform?: LoginPlatform;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
