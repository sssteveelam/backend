import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const TIMEOUT_MINUTES_MAX = 1440;

export class UpdateTimeoutsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TIMEOUT_MINUTES_MAX)
  softReserveMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TIMEOUT_MINUTES_MAX)
  hardLockMinutes!: number;
}
