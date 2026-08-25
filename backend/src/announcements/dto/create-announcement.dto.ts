import { AudienceRole } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  title!: string;

  // Optional — a mobile-posted announcement may carry only an image, with
  // the body added in a second request via attachImage(). The "body or
  // image" rule is enforced client-side, not here.
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one audience' })
  @IsEnum(AudienceRole, { each: true })
  audiences!: AudienceRole[];
}
