import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class SoftReserveDto {
  @IsUUID()
  productId!: string;

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

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  ttlSeconds!: number;
}
