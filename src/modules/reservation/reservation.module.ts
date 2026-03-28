import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AppConfigModule } from '../config/config.module';
import { ReservationController } from './reservation.controller';
import { ReservationRepository } from './reservation.repository';
import { ReservationService } from './reservation.service';
import { ReservationTimeoutService } from './reservation-timeout.service';
import { ReservationWorkerScheduler } from './reservation-worker.scheduler';

@Module({
  imports: [AuditModule, AppConfigModule],
  controllers: [ReservationController],
  providers: [
    ReservationService,
    ReservationRepository,
    ReservationTimeoutService,
    ReservationWorkerScheduler,
  ],
  exports: [ReservationService, ReservationTimeoutService],
})
export class ReservationModule {}
