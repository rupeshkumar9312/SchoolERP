import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

// subjectId is not editable — remove and re-add the subject row instead of
// repointing it, same "no in-place identity change" rule as UpdateExamDto.
export class UpdateExamSubjectDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}
