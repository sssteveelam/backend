import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reservation } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { SoftReserveDto } from './dto/soft-reserve.dto';
import { ReservationRepository } from './reservation.repository';

type ReservationStatus = 'soft_reserved' | 'hard_locked' | 'released';

@Injectable()
export class ReservationService {
  private readonly activityActions = new Set([
    'scan QR',
    'update picked quantity',
    'complete line',
    'complete location',
    'change pick target',
  ]);

  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
  ) {}

  async softReserve(actorUserId: string, dto: SoftReserveDto): Promise<Reservation> {
    this.contextService.setActorUserId(actorUserId);
    if (dto.quantityBase <= 0) {
      throw new BadRequestException('quantity_base phải > 0');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + dto.ttlSeconds * 1000);

    return this.reservationRepository.withTransaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId }, select: { id: true } });
      const batch = await tx.batch.findUnique({ where: { id: dto.batchId }, select: { id: true } });
      const location = await tx.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true },
      });
      if (!product || !batch || !location) {
        throw new NotFoundException('product/batch/location không tồn tại');
      }

      if (dto.containerId) {
        const container = await tx.container.findUnique({
          where: { id: dto.containerId },
          select: { id: true, locationId: true },
        });
        if (!container) {
          throw new NotFoundException('Container không tồn tại');
        }
        if (container.locationId !== dto.locationId) {
          throw new BadRequestException('Container không thuộc location chỉ định');
        }
      }

      await tx.$queryRaw`
        SELECT id
        FROM stock_lines
        WHERE product_id = ${dto.productId}::uuid
          AND batch_id = ${dto.batchId}::uuid
          AND location_id = ${dto.locationId}::uuid
          AND container_id IS NOT DISTINCT FROM ${dto.containerId ?? null}::uuid
        FOR UPDATE
      `;

      if (dto.containerId) {
        await tx.$queryRaw`
          SELECT id
          FROM containers
          WHERE id = ${dto.containerId}::uuid
          FOR UPDATE
        `;
      }

      const stockLine = await tx.stockLine.findFirst({
        where: {
          productId: dto.productId,
          batchId: dto.batchId,
          locationId: dto.locationId,
          containerId: dto.containerId ?? null,
        },
      });

      const reservedAgg = await tx.reservation.aggregate({
        where: {
          productId: dto.productId,
          batchId: dto.batchId,
          locationId: dto.locationId,
          containerId: dto.containerId ?? null,
          status: { in: ['soft_reserved', 'hard_locked'] },
        },
        _sum: { quantityBase: true },
      });

      const stockQty = new Prisma.Decimal(stockLine?.quantityBase ?? 0);
      const reservedQty = new Prisma.Decimal(reservedAgg._sum.quantityBase ?? 0);
      const available = stockQty.minus(reservedQty);

      if (available.lt(dto.quantityBase)) {
        throw new ConflictException('RESERVATION_EXCEEDS_AVAILABLE');
      }

      const created = await tx.reservation.create({
        data: {
          productId: dto.productId,
          batchId: dto.batchId,
          locationId: dto.locationId,
          containerId: dto.containerId ?? null,
          quantityBase: dto.quantityBase,
          status: 'soft_reserved',
          expiresAt,
          lastActivityAt: now,
          createdBy: actorUserId,
        },
      });

      await this.auditService.logEvent({
        action: 'SOFT_RESERVE',
        entity_type: 'reservations',
        entity_id: created.id,
        before: null,
        after: created,
        reason: 'Create soft reservation',
      });

      return created;
    });
  }

  async hardLock(actorUserId: string, reservationId: string): Promise<Reservation> {
    this.contextService.setActorUserId(actorUserId);

    return this.reservationRepository.withTransaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM reservations
        WHERE id = ${reservationId}::uuid
        FOR UPDATE
      `;

      const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new NotFoundException('Reservation không tồn tại');
      if (reservation.status === 'released') {
        throw new ConflictException('RESERVATION_ALREADY_RELEASED');
      }

      await tx.$queryRaw`
        SELECT id
        FROM stock_lines
        WHERE product_id = ${reservation.productId}::uuid
          AND batch_id = ${reservation.batchId}::uuid
          AND location_id = ${reservation.locationId}::uuid
          AND container_id IS NOT DISTINCT FROM ${reservation.containerId}::uuid
        FOR UPDATE
      `;

      if (reservation.containerId) {
        await tx.$queryRaw`
          SELECT id
          FROM containers
          WHERE id = ${reservation.containerId}::uuid
          FOR UPDATE
        `;
      }

      if (reservation.status !== 'soft_reserved') {
        throw new ConflictException('RESERVATION_INVALID_STATE_FOR_HARD_LOCK');
      }
      if (reservation.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException('RESERVATION_EXPIRED');
      }

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'hard_locked' },
      });

      await this.auditService.logEvent({
        action: 'HARD_LOCK',
        entity_type: 'reservations',
        entity_id: updated.id,
        before: reservation,
        after: updated,
        reason: 'Convert soft reservation to hard lock',
      });

      return updated;
    });
  }

  async release(actorUserId: string, reservationId: string): Promise<Reservation> {
    this.contextService.setActorUserId(actorUserId);

    return this.reservationRepository.withTransaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM reservations
        WHERE id = ${reservationId}::uuid
        FOR UPDATE
      `;

      const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new NotFoundException('Reservation không tồn tại');
      if (reservation.status === 'released') {
        throw new ConflictException('RESERVATION_ALREADY_RELEASED');
      }

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'released' },
      });

      await this.auditService.logEvent({
        action: 'RELEASE_RESERVATION',
        entity_type: 'reservations',
        entity_id: updated.id,
        before: reservation,
        after: updated,
        reason: 'Release reservation',
      });

      return updated;
    });
  }

  async updateActivity(actorUserId: string, reservationId: string, action: string): Promise<Reservation | null> {
    this.contextService.setActorUserId(actorUserId);
    if (!this.activityActions.has(action)) {
      return null;
    }

    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status === 'released') {
      return null;
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { lastActivityAt: new Date() },
    });
  }

  async getAvailableQuantity(input: {
    productId: string;
    batchId: string;
    locationId: string;
    containerId?: string;
  }): Promise<{ available: Prisma.Decimal; stock: Prisma.Decimal; reserved: Prisma.Decimal }> {
    const stockLine = await this.prisma.stockLine.findFirst({
      where: {
        productId: input.productId,
        batchId: input.batchId,
        locationId: input.locationId,
        containerId: input.containerId ?? null,
      },
      select: { quantityBase: true },
    });
    const reservedAgg = await this.prisma.reservation.aggregate({
      where: {
        productId: input.productId,
        batchId: input.batchId,
        locationId: input.locationId,
        containerId: input.containerId ?? null,
        status: { in: ['soft_reserved', 'hard_locked'] as ReservationStatus[] },
      },
      _sum: { quantityBase: true },
    });
    const stock = new Prisma.Decimal(stockLine?.quantityBase ?? 0);
    const reserved = new Prisma.Decimal(reservedAgg._sum.quantityBase ?? 0);
    return {
      stock,
      reserved,
      available: stock.minus(reserved),
    };
  }
}
