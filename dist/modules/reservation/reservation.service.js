"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const prisma_service_1 = require("../prisma/prisma.service");
const reservation_repository_1 = require("./reservation.repository");
let ReservationService = class ReservationService {
    constructor(reservationRepository, prisma, contextService, auditService) {
        this.reservationRepository = reservationRepository;
        this.prisma = prisma;
        this.contextService = contextService;
        this.auditService = auditService;
        this.activityActions = new Set([
            'scan QR',
            'update picked quantity',
            'complete line',
            'complete location',
            'change pick target',
        ]);
    }
    async softReserve(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (dto.quantityBase <= 0) {
            throw new common_1.BadRequestException('quantity_base phải > 0');
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
                throw new common_1.NotFoundException('product/batch/location không tồn tại');
            }
            if (dto.containerId) {
                const container = await tx.container.findUnique({
                    where: { id: dto.containerId },
                    select: { id: true, locationId: true },
                });
                if (!container) {
                    throw new common_1.NotFoundException('Container không tồn tại');
                }
                if (container.locationId !== dto.locationId) {
                    throw new common_1.BadRequestException('Container không thuộc location chỉ định');
                }
            }
            await tx.$queryRaw `
        SELECT id
        FROM stock_lines
        WHERE product_id = ${dto.productId}::uuid
          AND batch_id = ${dto.batchId}::uuid
          AND location_id = ${dto.locationId}::uuid
          AND container_id IS NOT DISTINCT FROM ${dto.containerId ?? null}::uuid
        FOR UPDATE
      `;
            if (dto.containerId) {
                await tx.$queryRaw `
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
            const stockQty = new client_1.Prisma.Decimal(stockLine?.quantityBase ?? 0);
            const reservedQty = new client_1.Prisma.Decimal(reservedAgg._sum.quantityBase ?? 0);
            const available = stockQty.minus(reservedQty);
            if (available.lt(dto.quantityBase)) {
                throw new common_1.ConflictException('RESERVATION_EXCEEDS_AVAILABLE');
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
    async hardLock(actorUserId, reservationId) {
        this.contextService.setActorUserId(actorUserId);
        return this.reservationRepository.withTransaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id
        FROM reservations
        WHERE id = ${reservationId}::uuid
        FOR UPDATE
      `;
            const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
            if (!reservation)
                throw new common_1.NotFoundException('Reservation không tồn tại');
            if (reservation.status === 'released') {
                throw new common_1.ConflictException('RESERVATION_ALREADY_RELEASED');
            }
            await tx.$queryRaw `
        SELECT id
        FROM stock_lines
        WHERE product_id = ${reservation.productId}::uuid
          AND batch_id = ${reservation.batchId}::uuid
          AND location_id = ${reservation.locationId}::uuid
          AND container_id IS NOT DISTINCT FROM ${reservation.containerId}::uuid
        FOR UPDATE
      `;
            if (reservation.containerId) {
                await tx.$queryRaw `
          SELECT id
          FROM containers
          WHERE id = ${reservation.containerId}::uuid
          FOR UPDATE
        `;
            }
            if (reservation.status !== 'soft_reserved') {
                throw new common_1.ConflictException('RESERVATION_INVALID_STATE_FOR_HARD_LOCK');
            }
            if (reservation.expiresAt.getTime() <= Date.now()) {
                throw new common_1.ConflictException('RESERVATION_EXPIRED');
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
    async release(actorUserId, reservationId) {
        this.contextService.setActorUserId(actorUserId);
        return this.reservationRepository.withTransaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id
        FROM reservations
        WHERE id = ${reservationId}::uuid
        FOR UPDATE
      `;
            const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
            if (!reservation)
                throw new common_1.NotFoundException('Reservation không tồn tại');
            if (reservation.status === 'released') {
                throw new common_1.ConflictException('RESERVATION_ALREADY_RELEASED');
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
    async updateActivity(actorUserId, reservationId, action) {
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
    async getAvailableQuantity(input) {
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
                status: { in: ['soft_reserved', 'hard_locked'] },
            },
            _sum: { quantityBase: true },
        });
        const stock = new client_1.Prisma.Decimal(stockLine?.quantityBase ?? 0);
        const reserved = new client_1.Prisma.Decimal(reservedAgg._sum.quantityBase ?? 0);
        return {
            stock,
            reserved,
            available: stock.minus(reserved),
        };
    }
};
exports.ReservationService = ReservationService;
exports.ReservationService = ReservationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reservation_repository_1.ReservationRepository,
        prisma_service_1.PrismaService,
        context_service_1.ContextService,
        audit_service_1.AuditService])
], ReservationService);
//# sourceMappingURL=reservation.service.js.map