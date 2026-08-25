import { AudienceRole } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  // No MinLength here (unlike create) — an empty string is a valid PATCH
  // value meaning "clear the body," reachable when an image remains
  // attached so the announcement still has content.
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one audience' })
  @IsEnum(AudienceRole, { each: true })
  audiences?: AudienceRole[];
}
