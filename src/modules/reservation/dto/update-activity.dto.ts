import { IsString } from 'class-validator';

export class UpdateActivityDto {
  @IsString()
  action!: string;
}
