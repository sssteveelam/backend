import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCycleCountDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
