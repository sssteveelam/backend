import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { MovementModule } from '../movement/movement.module';
import { CycleCountController } from './cycle-count.controller';
import { CycleCountRepository } from './cycle-count.repository';
import { CycleCountService } from './cycle-count.service';

@Module({
  imports: [AuditModule, MovementModule, ApprovalModule],
  controllers: [CycleCountController],
  providers: [CycleCountService, CycleCountRepository],
})
export class CycleCountModule {}
