import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class ListTeachersQueryDto extends PaginationQueryDto {
  /** Omitted -> every teacher (the Teachers list page needs to show inactive
   * ones too, with its Active/Inactive badge). Rosters that should only ever
   * offer active teachers (e.g. staff attendance marking) pass isActive=true. */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}
