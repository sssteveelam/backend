import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ThresholdService } from './threshold.service';

@Module({
  imports: [AuditModule],
  controllers: [ApprovalController],
  providers: [ApprovalService, ThresholdService],
  exports: [ApprovalService, ThresholdService],
})
export class ApprovalModule {}
