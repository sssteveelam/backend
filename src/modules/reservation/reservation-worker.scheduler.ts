import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReservationTimeoutService } from './reservation-timeout.service';

@Injectable()
export class ReservationWorkerScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationWorkerScheduler.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly reservationTimeoutService: ReservationTimeoutService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get<string>('RESERVATION_WORKER_ENABLED', 'true');
    if (enabled === 'false' || enabled === '0') {
      this.logger.log('Reservation worker disabled (RESERVATION_WORKER_ENABLED=false)');
      return;
    }

    const raw = this.configService.get<string>('RESERVATION_AUTO_RELEASE_INTERVAL_MS', '60000');
    const intervalMs = Math.max(5000, parseInt(raw, 10) || 60_000);

    this.intervalHandle = setInterval(() => {
      void this.reservationTimeoutService.runAutoReleaseCycle().catch((err: unknown) => {
        this.logger.error(
          `Scheduled reservation auto-release error: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });
    }, intervalMs);

    this.logger.log(`Reservation worker scheduled every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}
