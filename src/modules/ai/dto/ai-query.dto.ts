import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { AiFeature } from '@prisma/client';

export class AiQueryDto {
  @IsOptional()
  @IsEnum(AiFeature)
  feature?: AiFeature;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
