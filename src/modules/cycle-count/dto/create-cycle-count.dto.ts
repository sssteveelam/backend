import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCycleCountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  locationId!: string;
}
