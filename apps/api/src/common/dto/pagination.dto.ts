import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  get skip() {
    return (this.page - 1) * this.limit;
  }
}

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};

export function paginate<T>(data: T[], total: number, dto: PaginationDto): Paginated<T> {
  return {
    data,
    meta: {
      page: dto.page,
      limit: dto.limit,
      total,
      pages: Math.max(1, Math.ceil(total / dto.limit)),
    },
  };
}
