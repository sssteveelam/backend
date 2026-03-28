import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AddMovementLineDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsUUID()
  containerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;
}
