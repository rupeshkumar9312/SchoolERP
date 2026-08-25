import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, ValidateNested } from 'class-validator';
import { ExamSubjectInputDto } from './create-exam.dto';

// Adds one more class to an existing Exam umbrella — fully independent of
// every other class already scheduled under it: its own dates, its own
// subject list picked from that class's real subjects, no name-matching, no
// shared template.
export class CreateExamScheduleDto {
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one subject' })
  @ValidateNested({ each: true })
  @Type(() => ExamSubjectInputDto)
  subjects!: ExamSubjectInputDto[];
}
