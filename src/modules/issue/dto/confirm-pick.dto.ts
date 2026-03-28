import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmPickDto {
  @IsArray()
  scanSequence!: string[];

  @IsString()
  scannedLocationQr!: string;

  @IsOptional()
  @IsString()
  scannedContainerQr?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  pickedQuantity!: number;
}
