import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

function toIntOrDefault(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toIntOrDefault(value, 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => toIntOrDefault(value, 20))
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 20;
}

export type PaginationInput = {
  page: number;
  limit: number;
};

export function getPaginationSkipTake(input: PaginationInput): { skip: number; take: number } {
  const safePage = input.page < 1 ? 1 : input.page;
  const safeLimit = input.limit < 1 ? 20 : input.limit;

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}
