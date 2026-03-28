import { IsUUID, IsOptional, IsInt, Min, Max, IsNumberString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class InventorySuggestionQueryDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsNumberString()
  quantityBase?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nearExpiryDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class InventorySuggestionItemDto {
  rank!: number;
  locationId!: string;
  locationCode!: string;
  containerId!: string | null;
  containerQrCode!: string | null;
  batchId!: string | null;
  batchLotCode!: string | null;
  expiryDate!: string | null;
  availableQuantityBase!: string; // Decimal string
  uomHint?: string | null;
  reason!: string;
}

export class InventorySuggestionResponseDto {
  productId!: string;
  basis!: string; // e.g. "FEFO"
  suggestions!: InventorySuggestionItemDto[];
}
