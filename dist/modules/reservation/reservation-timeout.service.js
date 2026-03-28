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
var ReservationTimeoutService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationTimeoutService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const system_user_constants_1 = require("../../common/system-user.constants");
const audit_service_1 = require("../audit/audit.service");
const app_timeout_config_service_1 = require("../config/app-timeout-config.service");
const prisma_service_1 = require("../prisma/prisma.service");
const reservation_repository_1 = require("./reservation.repository");
const BATCH_LIMIT = 200;
let ReservationTimeoutService = ReservationTimeoutService_1 = class ReservationTimeoutService {
    constructor(prisma, reservationRepository, auditService, appTimeoutConfigService) {
        this.prisma = prisma;
        this.reservationRepository = reservationRepository;
        this.auditService = auditService;
        this.appTimeoutConfigService = appTimeoutConfigService;
        this.logger = new common_1.Logger(ReservationTimeoutService_1.name);
    }
    async ensureSystemUser() {
        await this.prisma.user.upsert({
            where: { id: system_user_constants_1.SYSTEM_USER_ID },
            create: {
                id: system_user_constants_1.SYSTEM_USER_ID,
                username: 'system',
                email: 'system@internal.local',
                passwordHash: '$2b$10$7EqJtq98hPqEX7fNZaFWoOhi6fW9G5N0y.tP.oI8B6YlOUG9N9uiG',
                role: 'admin',
                status: 'active',
            },
            update: {},
        });
    }
    async runAutoReleaseCycle() {
        const correlationId = (0, crypto_1.randomUUID)();
        let softReleased = 0;
        let hardReleased = 0;
        try {
            await this.ensureSystemUser();
            const now = new Date();
            const { hardLockMinutes } = await this.appTimeoutConfigService.getTimeouts();
            const hardInactivityCutoff = new Date(now.getTime() - hardLockMinutes * 60 * 1000);
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
                if (candidates.length === 0)
                    break;
                for (const { id } of candidates) {
                    const outcome = await this.tryAutoReleaseSoftExpired(id, now, correlationId);
                    if (outcome.released)
                        softReleased += 1;
                }
            }
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
                if (candidates.length === 0)
                    break;
                for (const { id } of candidates) {
                    const outcome = await this.tryAutoReleaseHardInactive(id, hardInactivityCutoff, correlationId);
                    if (outcome.released)
                        hardReleased += 1;
                }
            }
            this.logger.log(`Reservation auto-release completed: softReleased=${softReleased}, hardReleased=${hardReleased}, correlationId=${correlationId}`);
        }
        catch (err) {
            this.logger.error(`Reservation auto-release failed: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
            throw err;
        }
        return { correlationId, softReleased, hardReleased };
    }
    async tryAutoReleaseSoftExpired(reservationId, now, correlationId) {
        const outcome = await this.reservationRepository.withTransaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE
      `;
            const row = await tx.reservation.findUnique({ where: { id: reservationId } });
            if (!row || row.status === 'released') {
                return { released: false };
            }
            if (row.status !== 'soft_reserved') {
                return { released: false };
            }
            if (row.expiresAt.getTime() >= now.getTime()) {
                return { released: false };
            }
            const after = await tx.reservation.update({
                where: { id: reservationId },
                data: { status: 'released' },
            });
            return { released: true, before: row, after };
        });
        if (!outcome.released) {
            return { released: false };
        }
        try {
            await this.auditService.logSystemEvent({
                actorUserId: system_user_constants_1.SYSTEM_USER_ID,
                correlationId,
                action: 'AUTO_RELEASE_SOFT_RESERVATION',
                entity_type: 'reservations',
                entity_id: reservationId,
                before: outcome.before,
                after: outcome.after,
                reason: 'Auto-release: soft reservation expired (worker)',
            });
        }
        catch (auditErr) {
            this.logger.error(`AUTO_RELEASE_SOFT_RESERVATION audit failed for ${reservationId}: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`);
        }
        return { released: true, before: outcome.before, after: outcome.after };
    }
    async tryAutoReleaseHardInactive(reservationId, inactivityCutoff, correlationId) {
        const outcome = await this.reservationRepository.withTransaction(async (tx) => {
            await tx.$queryRaw `
        SELECT id FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE
      `;
            const row = await tx.reservation.findUnique({ where: { id: reservationId } });
            if (!row || row.status === 'released') {
                return { released: false };
            }
            if (row.status !== 'hard_locked') {
                return { released: false };
            }
            if (row.lastActivityAt.getTime() >= inactivityCutoff.getTime()) {
                return { released: false };
            }
            const after = await tx.reservation.update({
                where: { id: reservationId },
                data: { status: 'released' },
            });
            return { released: true, before: row, after };
        });
        if (!outcome.released) {
            return { released: false };
        }
        try {
            await this.auditService.logSystemEvent({
                actorUserId: system_user_constants_1.SYSTEM_USER_ID,
                correlationId,
                action: 'AUTO_RELEASE_HARD_LOCK',
                entity_type: 'reservations',
                entity_id: reservationId,
                before: outcome.before,
                after: outcome.after,
                reason: 'Auto-release: hard lock inactive (worker, policy: release)',
            });
        }
        catch (auditErr) {
            this.logger.error(`AUTO_RELEASE_HARD_LOCK audit failed for ${reservationId}: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`);
        }
        return { released: true, before: outcome.before, after: outcome.after };
    }
};
exports.ReservationTimeoutService = ReservationTimeoutService;
exports.ReservationTimeoutService = ReservationTimeoutService = ReservationTimeoutService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reservation_repository_1.ReservationRepository,
        audit_service_1.AuditService,
        app_timeout_config_service_1.AppTimeoutConfigService])
], ReservationTimeoutService);
//# sourceMappingURL=reservation-timeout.service.js.map