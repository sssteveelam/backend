import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const PICK_TASK_STATUS_VALUES = ['pending', 'done', 'cancelled'] as const;

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class PickTaskListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn(PICK_TASK_STATUS_VALUES)
  status?: (typeof PICK_TASK_STATUS_VALUES)[number];
}
