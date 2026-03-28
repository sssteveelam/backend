import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class PickAllocationOverrideDto {
  @IsUUID()
  issueLineId!: string;

  @IsUUID()
  batchId!: string;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsUUID()
  containerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;
}

export class PlanPicksDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickAllocationOverrideDto)
  overrides?: PickAllocationOverrideDto[];
}
