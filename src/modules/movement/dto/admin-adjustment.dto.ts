import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AdminAdjustmentDto {
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
  @Min(0)
  newQuantityBase!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
