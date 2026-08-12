import { AudienceRole } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one audience' })
  @IsEnum(AudienceRole, { each: true })
  audiences?: AudienceRole[];
}
