import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMovementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsUUID()
  fromLocationId!: string;

  @IsUUID()
  toLocationId!: string;
}
