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
exports.PickingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const prisma_service_1 = require("../prisma/prisma.service");
const reservation_service_1 = require("../reservation/reservation.service");
let PickingService = class PickingService {
    constructor(prisma, reservationService, contextService, auditService) {
        this.prisma = prisma;
        this.reservationService = reservationService;
        this.contextService = contextService;
        this.auditService = auditService;
    }
    async getSuggestions(actorUserId, taskId) {
        this.contextService.setActorUserId(actorUserId);
        const task = await this.prisma.pickTask.findUnique({
            where: { id: taskId },
            include: {
                location: true,
                container: true,
                batch: true,
                product: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Pick task không tồn tại');
        const requiresContainer = Boolean(task.containerId);
        return {
            pickTaskId: task.id,
            scanSequenceRecommended: requiresContainer ? ['location', 'container'] : ['location'],
            expected: {
                locationId: task.locationId,
                locationQrCode: task.location.code,
                containerId: task.containerId,
                containerQrCode: task.container?.qrCode || null,
                batchId: task.batchId,
                batchLotCode: task.batch.lotCode,
                productId: task.productId,
            },
            hints: {
                requiresContainerScan: requiresContainer,
                requiresLocationScan: true,
                allowMissingContainer: false,
            },
        };
    }
    async confirmPick(actorUserId, taskId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const task = await this.prisma.pickTask.findUnique({
            where: { id: taskId },
            include: {
                location: true,
                container: true,
                reservation: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Pick task không tồn tại');
        if (!task.reservationId || !task.reservation) {
            throw new common_1.ConflictException('Pick task chưa có reservation');
        }
        if (task.reservation.status !== 'hard_locked') {
            throw new common_1.ConflictException('Chỉ được pick khi reservation hard_locked');
        }
        if (task.status === 'done') {
            throw new common_1.ConflictException('Pick task đã done');
        }
        this.validateScanOrder(dto.scanSequence, Boolean(task.containerId));
        if (dto.scannedLocationQr !== task.location.code) {
            throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
        }
        if (task.containerId) {
            if (!dto.scannedContainerQr || dto.scannedContainerQr !== task.container?.qrCode) {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
        }
        if (task.containerId && task.container?.isSealed) {
            const containerTotal = await this.prisma.stockLine.aggregate({
                where: { containerId: task.containerId },
                _sum: { quantityBase: true },
            });
            const totalQty = Number(containerTotal._sum.quantityBase ?? 0);
            const nextPickedCheck = Number(new client_1.Prisma.Decimal(task.pickedQuantity).plus(dto.pickedQuantity));
            const taskQty = Number(task.quantityBase);
            if (totalQty <= 0 ||
                Math.abs(taskQty - totalQty) > 0.000001 ||
                Math.abs(nextPickedCheck - totalQty) > 0.000001) {
                throw new common_1.ConflictException('CONTAINER_SEALED_PARTIAL_PICK_NOT_ALLOWED');
            }
        }
        const nextPicked = new client_1.Prisma.Decimal(task.pickedQuantity).plus(dto.pickedQuantity);
        if (nextPicked.gt(task.quantityBase)) {
            throw new common_1.ConflictException('PICK_EXCEEDS_TASK_QUANTITY');
        }
        const updated = await this.prisma.pickTask.update({
            where: { id: task.id },
            data: {
                pickedQuantity: nextPicked,
                status: nextPicked.eq(task.quantityBase) ? 'done' : 'picking',
            },
        });
        await this.reservationService.updateActivity(actorUserId, task.reservationId, 'update picked quantity');
        await this.auditService.logEvent({
            action: 'CONFIRM_PICK',
            entity_type: 'pick_tasks',
            entity_id: task.id,
            before: task,
            after: updated,
            reason: 'Confirm picked quantity',
        });
        return updated;
    }
    validateScanOrder(scanSequence, requiresContainer) {
        if (requiresContainer) {
            if (!Array.isArray(scanSequence) ||
                scanSequence.length !== 2 ||
                scanSequence[0] !== 'location' ||
                scanSequence[1] !== 'container') {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
            return;
        }
        if (!Array.isArray(scanSequence) ||
            scanSequence.length !== 1 ||
            scanSequence[0] !== 'location') {
            throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
        }
    }
};
exports.PickingService = PickingService;
exports.PickingService = PickingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reservation_service_1.ReservationService,
        context_service_1.ContextService,
        audit_service_1.AuditService])
], PickingService);
//# sourceMappingURL=picking.service.js.map