import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitReceiptDto {
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
