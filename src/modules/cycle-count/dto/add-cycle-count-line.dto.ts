import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class AddCycleCountLineDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsUUID()
  containerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQuantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsIn(['location', 'container'], { each: true })
  scanSequence?: string[];

  @IsOptional()
  @IsUUID()
  scannedLocationId?: string;

  @IsOptional()
  @IsUUID()
  scannedContainerId?: string;
}
