import { AudienceRole } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one audience' })
  @IsEnum(AudienceRole, { each: true })
  audiences!: AudienceRole[];
}
