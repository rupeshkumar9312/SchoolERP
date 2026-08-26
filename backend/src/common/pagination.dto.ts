import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from './pagination';

/** Extend this on any List*QueryDto that should support pagination —
 * `page`/`limit` are both optional so every existing caller (including
 * routes not yet migrated to `resolvePagination()`) keeps working unchanged. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}
