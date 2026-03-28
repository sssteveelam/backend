import { IsIn, IsString, MinLength } from 'class-validator';

export class OpenSealDto {
  @IsString()
  @MinLength(1)
  reason!: string;

  @IsString()
  @IsIn(['issue', 'warehouse_op'])
  context!: 'issue' | 'warehouse_op';
}
