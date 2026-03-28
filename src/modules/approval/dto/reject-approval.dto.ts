import { IsNotEmpty, IsString } from 'class-validator';

export class RejectApprovalDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
