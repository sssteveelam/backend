import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AppConfigModule } from '../config/config.module';
import { ReservationModule } from '../reservation/reservation.module';
import { IssueController } from './issue.controller';
import { IssueRepository } from './issue.repository';
import { IssueService } from './issue.service';
import { PickingService } from './picking.service';

@Module({
  imports: [AuditModule, ReservationModule, AppConfigModule],
  controllers: [IssueController],
  providers: [IssueRepository, IssueService, PickingService],
})
export class IssueModule {}
