import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateIssueLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantityBase!: number;
}

export class CreateIssueDto {
  @IsString()
  code!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIssueLineDto)
  lines!: CreateIssueLineDto[];
}
