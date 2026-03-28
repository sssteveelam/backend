import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ApprovalModule } from '../approval/approval.module';
import { CapacityModule } from '../capacity/capacity.module';
import { MovementController } from './movement.controller';
import { MovementService } from './movement.service';
import { MovementRepository } from './movement.repository';
import { AdjustmentService } from './adjustment.service';

@Module({
  imports: [AuditModule, IdempotencyModule, ApprovalModule, CapacityModule],
  controllers: [MovementController],
  providers: [MovementService, MovementRepository, AdjustmentService],
  exports: [AdjustmentService],
})
export class MovementModule {}
