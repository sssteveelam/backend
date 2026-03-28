import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Reservation } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SYSTEM_USER_ID } from '../../common/system-user.constants';
import { AuditService } from '../audit/audit.service';
import { AppTimeoutConfigService } from '../config/app-timeout-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationRepository } from './reservation.repository';

const BATCH_LIMIT = 200;

type ReleaseOutcome =
  | { released: false }
  | { released: true; before: Reservation; after: Reservation };

@Injectable()
export class ReservationTimeoutService {
  private readonly logger = new Logger(ReservationTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationRepository: ReservationRepository,
    private readonly auditService: AuditService,
    private readonly appTimeoutConfigService: AppTimeoutConfigService,
  ) {}

  /**
   * Ensures system user exists for audit FK (safe after test DB truncates).
   */
  async ensureSystemUser(): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: SYSTEM_USER_ID },
      create: {
        id: SYSTEM_USER_ID,
        username: 'system',
        email: 'system@internal.local',
        passwordHash: '$2b$10$7EqJtq98hPqEX7fNZaFWoOhi6fW9G5N0y.tP.oI8B6YlOUG9N9uiG', // bcrypt "no-login-worker"
        role: 'admin',
        status: 'active',
      },
      update: {},
    });
  }

  /**
   * One worker tick: process expired soft reservations, then inactive hard locks (policy A → released).
   */
  async runAutoReleaseCycle(): Promise<{
    correlationId: string;
    softReleased: number;
    hardReleased: number;
  }> {
    const correlationId = randomUUID();
    let softReleased = 0;
    let hardReleased = 0;

    try {
      await this.ensureSystemUser();
      const now = new Date();
      const { hardLockMinutes } = await this.appTimeoutConfigService.getTimeouts();
      const hardInactivityCutoff = new Date(now.getTime() - hardLockMinutes * 60 * 1000);

      // Case 1 — soft_reserved past expires_at
      for (let round = 0; round < 50; round += 1) {
        const candidates = await this.prisma.reservation.findMany({
          where: {
            status: 'soft_reserved',
            expiresAt: { lt: now },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_LIMIT,
        });
        if (candidates.length === 0) break;

        for (const { id } of candidates) {
          const outcome = await this.tryAutoReleaseSoftExpired(id, now, correlationId);
          if (outcome.released) softReleased += 1;
        }
      }

      // Case 2 — hard_locked inactive (last_activity_at older than configured window) → release
      for (let round = 0; round < 50; round += 1) {
        const candidates = await this.prisma.reservation.findMany({
          where: {
            status: 'hard_locked',
            lastActivityAt: { lt: hardInactivityCutoff },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_LIMIT,
        });
        if (candidates.length === 0) break;

        for (const { id } of candidates) {
          const outcome = await this.tryAutoReleaseHardInactive(id, hardInactivityCutoff, correlationId);
          if (outcome.released) hardReleased += 1;
        }
      }

      this.logger.log(
        `Reservation auto-release completed: softReleased=${softReleased}, hardReleased=${hardReleased}, correlationId=${correlationId}`,
      );
    } catch (err) {
      this.logger.error(
        `Reservation auto-release failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }

    return { correlationId, softReleased, hardReleased };
  }

  private async tryAutoReleaseSoftExpired(
    reservationId: string,
    now: Date,
    correlationId: string,
  ): Promise<ReleaseOutcome> {
    const outcome = await this.reservationRepository.withTransaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE
      `;

      const row = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!row || row.status === 'released') {
        return { released: false as const };
      }
      if (row.status !== 'soft_reserved') {
        return { released: false as const };
      }
      if (row.expiresAt.getTime() >= now.getTime()) {
        return { released: false as const };
      }

      const after = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'released' },
      });

      return { released: true as const, before: row, after };
    });

    if (!outcome.released) {
      return { released: false };
    }

    try {
      await this.auditService.logSystemEvent({
        actorUserId: SYSTEM_USER_ID,
        correlationId,
        action: 'AUTO_RELEASE_SOFT_RESERVATION',
        entity_type: 'reservations',
        entity_id: reservationId,
        before: outcome.before as unknown as Prisma.InputJsonValue,
        after: outcome.after as unknown as Prisma.InputJsonValue,
        reason: 'Auto-release: soft reservation expired (worker)',
      });
    } catch (auditErr) {
      this.logger.error(
        `AUTO_RELEASE_SOFT_RESERVATION audit failed for ${reservationId}: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`,
      );
    }

    return { released: true, before: outcome.before, after: outcome.after };
  }

  private async tryAutoReleaseHardInactive(
    reservationId: string,
    inactivityCutoff: Date,
    correlationId: string,
  ): Promise<ReleaseOutcome> {
    const outcome = await this.reservationRepository.withTransaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE
      `;

      const row = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!row || row.status === 'released') {
        return { released: false as const };
      }
      if (row.status !== 'hard_locked') {
        return { released: false as const };
      }
      if (row.lastActivityAt.getTime() >= inactivityCutoff.getTime()) {
        return { released: false as const };
      }

      const after = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'released' },
      });

      return { released: true as const, before: row, after };
    });

    if (!outcome.released) {
      return { released: false };
    }

    try {
      await this.auditService.logSystemEvent({
        actorUserId: SYSTEM_USER_ID,
        correlationId,
        action: 'AUTO_RELEASE_HARD_LOCK',
        entity_type: 'reservations',
        entity_id: reservationId,
        before: outcome.before as unknown as Prisma.InputJsonValue,
        after: outcome.after as unknown as Prisma.InputJsonValue,
        reason: 'Auto-release: hard lock inactive (worker, policy: release)',
      });
    } catch (auditErr) {
      this.logger.error(
        `AUTO_RELEASE_HARD_LOCK audit failed for ${reservationId}: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`,
      );
    }

    return { released: true, before: outcome.before, after: outcome.after };
  }
}
