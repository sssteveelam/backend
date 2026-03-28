import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SubmitMovementDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsIn(['container', 'location'], { each: true })
  scanSequence!: string[];

  @IsUUID()
  scannedContainerId!: string;

  @IsString()
  @IsNotEmpty()
  scannedContainerQr!: string;

  @IsUUID()
  scannedLocationId!: string;

  @IsString()
  @IsNotEmpty()
  scannedLocationQr!: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  overrideCapacity?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  overrideReason?: string;
}
