import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AddReceiptLineDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  uom!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsDateString()
  manufactureDate!: string;

  @IsDateString()
  expiryDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lotCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  containerQrCode?: string;
}
