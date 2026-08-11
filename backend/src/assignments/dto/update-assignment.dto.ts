import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

// classId/sectionId/subjectId/teacherId are intentionally not editable — an
// assignment's ownership check at creation time already proved the teacher
// may set homework for that exact class+section+subject; changing it after
// the fact would need re-running that check, so moving an assignment to a
// different class is "delete and recreate," not "edit."
export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
