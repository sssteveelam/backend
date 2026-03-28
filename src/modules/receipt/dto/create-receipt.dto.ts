import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  supplierId!: string;

  @IsUUID()
  warehouseId!: string;
}
