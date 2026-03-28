import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductUomDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsString()
  @MaxLength(50)
  uom!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  factorToBase!: number;
}
