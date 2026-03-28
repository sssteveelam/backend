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
exports.MovementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const idempotency_service_1 = require("../idempotency/idempotency.service");
const approval_service_1 = require("../approval/approval.service");
const threshold_service_1 = require("../approval/threshold.service");
const capacity_service_1 = require("../capacity/capacity.service");
const prisma_service_1 = require("../prisma/prisma.service");
const movement_repository_1 = require("./movement.repository");
const adjustment_service_1 = require("./adjustment.service");
const list_response_dto_1 = require("../../common/dto/list-response.dto");
const pagination_query_dto_1 = require("../../common/dto/pagination-query.dto");
let MovementService = class MovementService {
    constructor(movementRepository, prisma, contextService, auditService, idempotencyService, approvalService, thresholdService, capacityService, adjustmentService) {
        this.movementRepository = movementRepository;
        this.prisma = prisma;
        this.contextService = contextService;
        this.auditService = auditService;
        this.idempotencyService = idempotencyService;
        this.approvalService = approvalService;
        this.thresholdService = thresholdService;
        this.capacityService = capacityService;
        this.adjustmentService = adjustmentService;
    }
    async listMovements(query) {
        if (query.createdFrom && query.createdTo) {
            const from = new Date(query.createdFrom);
            const to = new Date(query.createdTo);
            if (from > to) {
                throw new common_1.BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
            }
        }
        const { skip, take } = (0, pagination_query_dto_1.getPaginationSkipTake)({ page: query.page, limit: query.limit });
        const { rows, total } = await this.movementRepository.listMovements(query, skip, take);
        return (0, list_response_dto_1.buildListResponse)({
            data: rows.map((row) => ({
                id: row.id,
                code: row.code,
                status: row.status,
                fromLocationId: row.fromLocationId,
                toLocationId: row.toLocationId,
                createdBy: row.createdBy,
                createdAt: row.createdAt.toISOString(),
            })),
            page: query.page,
            limit: query.limit,
            total,
        });
    }
    async getMovementDetail(movementId) {
        const movement = await this.movementRepository.findMovementWithLinesById(movementId);
        if (!movement) {
            throw new common_1.NotFoundException('Movement không tồn tại');
        }
        const lines = movement.lines.map((line) => ({
            id: line.id,
            movementId: line.movementId,
            productId: line.productId,
            batchId: line.batchId,
            containerId: line.containerId,
            quantityBase: line.quantityBase.toString(),
            createdAt: line.createdAt.toISOString(),
        }));
        return {
            id: movement.id,
            code: movement.code,
            status: movement.status,
            fromLocationId: movement.fromLocationId,
            toLocationId: movement.toLocationId,
            createdBy: movement.createdBy,
            createdAt: movement.createdAt.toISOString(),
            lines,
        };
    }
    ensureScanOrder(dto) {
        if (!Array.isArray(dto.scanSequence) ||
            dto.scanSequence.length !== 2 ||
            dto.scanSequence[0] !== 'container' ||
            dto.scanSequence[1] !== 'location') {
            throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
        }
    }
    async createMovement(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (dto.fromLocationId === dto.toLocationId) {
            throw new common_1.BadRequestException('from_location và to_location không được trùng');
        }
        const fromLocation = await this.prisma.location.findUnique({ where: { id: dto.fromLocationId } });
        const toLocation = await this.prisma.location.findUnique({ where: { id: dto.toLocationId } });
        if (!fromLocation || !toLocation) {
            throw new common_1.NotFoundException('Location không tồn tại');
        }
        const existed = await this.movementRepository.findMovementByCode(dto.code);
        if (existed)
            throw new common_1.ConflictException('Movement code đã tồn tại');
        const created = await this.movementRepository.createMovement({
            code: dto.code,
            status: 'draft',
            fromLocation: { connect: { id: dto.fromLocationId } },
            toLocation: { connect: { id: dto.toLocationId } },
            creator: { connect: { id: actorUserId } },
        });
        await this.auditService.logEvent({
            action: 'CREATE_MOVEMENT',
            entity_type: 'movements',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Create movement draft',
        });
        return created;
    }
    async addLine(actorUserId, movementId, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (dto.quantityBase <= 0) {
            throw new common_1.BadRequestException('quantity_base phải > 0');
        }
        const movement = await this.movementRepository.findMovementById(movementId);
        if (!movement)
            throw new common_1.NotFoundException('Movement không tồn tại');
        if (movement.status !== 'draft')
            throw new common_1.ForbiddenException('Chỉ thêm line khi movement draft');
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
        if (!product || !batch)
            throw new common_1.NotFoundException('Product hoặc batch không tồn tại');
        if (dto.containerId) {
            const container = await this.prisma.container.findUnique({ where: { id: dto.containerId } });
            if (!container)
                throw new common_1.NotFoundException('Container không tồn tại');
        }
        const created = await this.movementRepository.createMovementLine({
            quantityBase: dto.quantityBase,
            movement: { connect: { id: movementId } },
            product: { connect: { id: dto.productId } },
            batch: { connect: { id: dto.batchId } },
            container: dto.containerId ? { connect: { id: dto.containerId } } : undefined,
        });
        await this.auditService.logEvent({
            action: 'ADD_MOVEMENT_LINE',
            entity_type: 'movement_lines',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Add movement line',
        });
        return created;
    }
    async submitMovement(actorUserId, actorRole, movementId, idempotencyKey, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (!idempotencyKey)
            throw new common_1.BadRequestException('Idempotency-Key là bắt buộc');
        const route = `/movements/${movementId}/submit`;
        const idem = await this.idempotencyService.findOne({ actorUserId, route, key: idempotencyKey });
        if (idem) {
            const currentRequestHash = this.idempotencyService.hashRequestBody(dto);
            if (idem.requestHash !== currentRequestHash) {
                throw new common_1.ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
            }
            if (idem.responseJson) {
                return idem.responseJson;
            }
        }
        const movement = await this.movementRepository.findMovementById(movementId);
        if (!movement)
            throw new common_1.NotFoundException('Movement không tồn tại');
        if (movement.status === 'submitted')
            throw new common_1.ConflictException('Movement đã submit');
        if (actorRole === 'staff' && !dto.overrideCapacity) {
            throw new common_1.ForbiddenException('Không có quyền truy cập');
        }
        this.ensureScanOrder(dto);
        const lines = await this.movementRepository.findMovementLines(movementId);
        if (lines.length === 0)
            throw new common_1.BadRequestException('Movement chưa có line');
        const currentToLocationStock = await this.prisma.stockLine.aggregate({
            where: { locationId: movement.toLocationId },
            _sum: { quantityBase: true },
        });
        const toLocation = await this.prisma.location.findUnique({ where: { id: movement.toLocationId } });
        if (!toLocation)
            throw new common_1.NotFoundException('Location không tồn tại');
        const incomingBaseQuantity = lines.reduce((sum, line) => sum + Number(line.quantityBase), 0);
        const capacityResult = this.capacityService.check({
            locationId: movement.toLocationId,
            capacityLimit: toLocation.capacityLimitBase ? Number(toLocation.capacityLimitBase) : null,
            incomingQuantity: incomingBaseQuantity,
            currentStock: Number(currentToLocationStock._sum.quantityBase ?? 0),
        });
        const capacityWarning = {
            isOver: capacityResult.isOver,
            isBigOver: capacityResult.isBigOver,
            message: capacityResult.warningMessage,
        };
        const overrideRequested = Boolean(dto.overrideCapacity);
        const capacityOverrideApplied = capacityResult.isOver && overrideRequested;
        if (capacityResult.isOver) {
            await this.auditService.logEvent({
                action: 'CAPACITY_WARNING',
                entity_type: 'movements',
                entity_id: movement.id,
                before: {
                    locationId: movement.toLocationId,
                    currentStock: Number(currentToLocationStock._sum.quantityBase ?? 0),
                },
                after: {
                    locationId: movement.toLocationId,
                    incomingQuantity: incomingBaseQuantity,
                    newTotal: capacityResult.newTotal,
                    overPercentage: capacityResult.overPercentage,
                    overAmount: capacityResult.overAmount,
                    isBigOver: capacityResult.isBigOver,
                },
                reason: dto.overrideReason,
            });
        }
        if (capacityResult.isBigOver && !overrideRequested) {
            const approvalRequest = await this.approvalService.createApprovalRequest({
                actorUserId,
                documentType: 'movement',
                documentId: movement.id,
                thresholdSnapshot: {
                    capacity: {
                        isOver: capacityResult.isOver,
                        isBigOver: capacityResult.isBigOver,
                        overPercentage: capacityResult.overPercentage,
                        overAmount: capacityResult.overAmount,
                        warningMessage: capacityResult.warningMessage,
                    },
                },
                reason: 'Capacity BIG_OVER requires approval',
            });
            const blockedResponse = {
                movement,
                blocked: true,
                approvalRequestId: approvalRequest.id,
                capacityWarning,
                overrideRequired: true,
            };
            await this.idempotencyService.createWithResponse({
                actorUserId,
                route,
                key: idempotencyKey,
                requestBody: dto,
                responseJson: blockedResponse,
            });
            return blockedResponse;
        }
        if (capacityResult.isOver) {
            if (!overrideRequested) {
                const softBlockedResponse = {
                    movement,
                    blocked: false,
                    approvalRequestId: null,
                    capacityWarning,
                    overrideRequired: true,
                };
                await this.idempotencyService.createWithResponse({
                    actorUserId,
                    route,
                    key: idempotencyKey,
                    requestBody: dto,
                    responseJson: softBlockedResponse,
                });
                return softBlockedResponse;
            }
            if (!dto.overrideReason?.trim()) {
                throw new common_1.BadRequestException('CAPACITY_OVERRIDE_REASON_REQUIRED');
            }
            if (actorRole === 'staff' && capacityResult.isBigOver) {
                throw new common_1.ForbiddenException('BIG_OVER_REQUIRES_APPROVAL');
            }
            await this.auditService.logEvent({
                action: 'CAPACITY_OVERRIDE',
                entity_type: 'movements',
                entity_id: movement.id,
                before: {
                    locationId: movement.toLocationId,
                    currentStock: Number(currentToLocationStock._sum.quantityBase ?? 0),
                },
                after: {
                    locationId: movement.toLocationId,
                    incomingQuantity: incomingBaseQuantity,
                    newTotal: capacityResult.newTotal,
                    overPercentage: capacityResult.overPercentage,
                    overAmount: capacityResult.overAmount,
                    isBigOver: capacityResult.isBigOver,
                },
                reason: dto.overrideReason,
            });
        }
        const lineThresholdInputs = await Promise.all(lines.map(async (line) => {
            const sourceStock = await this.prisma.stockLine.findFirst({
                where: {
                    productId: line.productId,
                    batchId: line.batchId,
                    locationId: movement.fromLocationId,
                    containerId: line.containerId ?? null,
                },
            });
            return {
                quantityBase: Number(line.quantityBase),
                baselineQuantityBase: Number(sourceStock?.quantityBase ?? 0),
            };
        }));
        const movementValue = await Promise.all(lines.map(async (line) => {
            const batch = await this.prisma.batch.findUnique({
                where: { id: line.batchId },
                select: { averageCost: true },
            });
            return Number(line.quantityBase) * Number(batch?.averageCost ?? 0);
        })).then((values) => values.reduce((sum, value) => sum + value, 0));
        const beforeMovement = movement;
        const response = await this.movementRepository.withTransaction(async (tx) => {
            const movementInTx = await tx.movement.findUnique({ where: { id: movement.id } });
            if (!movementInTx)
                throw new common_1.NotFoundException('Movement không tồn tại');
            if (movementInTx.status === 'submitted')
                throw new common_1.ConflictException('Movement đã submit');
            const scannedContainer = await tx.container.findUnique({ where: { id: dto.scannedContainerId } });
            if (!scannedContainer || scannedContainer.qrCode !== dto.scannedContainerQr) {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
            const movementContainerIds = lines
                .map((line) => line.containerId)
                .filter((containerId) => Boolean(containerId));
            if (movementContainerIds.length > 0 && !movementContainerIds.includes(scannedContainer.id)) {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
            const scannedLocation = await tx.location.findUnique({ where: { id: dto.scannedLocationId } });
            if (!scannedLocation || scannedLocation.code !== dto.scannedLocationQr) {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
            if (movement.toLocationId !== scannedLocation.id) {
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
            }
            for (const line of lines) {
                const source = await tx.stockLine.findFirst({
                    where: {
                        productId: line.productId,
                        batchId: line.batchId,
                        locationId: movement.fromLocationId,
                        containerId: line.containerId ?? null,
                    },
                });
                if (!source)
                    throw new common_1.BadRequestException('Không tồn tại tồn kho tại source location');
                if (line.quantityBase.gt(source.quantityBase)) {
                    throw new common_1.BadRequestException('Không đủ tồn để movement');
                }
                const nextSourceQty = new client_1.Prisma.Decimal(source.quantityBase).minus(line.quantityBase);
                if (nextSourceQty.lt(0)) {
                    throw new common_1.BadRequestException('Không cho phép âm tồn');
                }
                const beforeSource = source;
                const updatedSource = await tx.stockLine.update({
                    where: { id: source.id },
                    data: { quantityBase: nextSourceQty },
                });
                const destination = await tx.stockLine.findFirst({
                    where: {
                        productId: line.productId,
                        batchId: line.batchId,
                        locationId: movement.toLocationId,
                        containerId: line.containerId ?? null,
                    },
                });
                const beforeDestination = destination;
                let updatedDestination;
                if (destination) {
                    updatedDestination = await tx.stockLine.update({
                        where: { id: destination.id },
                        data: {
                            quantityBase: new client_1.Prisma.Decimal(destination.quantityBase).plus(line.quantityBase),
                        },
                    });
                }
                else {
                    updatedDestination = await tx.stockLine.create({
                        data: {
                            productId: line.productId,
                            batchId: line.batchId,
                            locationId: movement.toLocationId,
                            containerId: line.containerId ?? null,
                            quantityBase: line.quantityBase,
                        },
                    });
                }
                if (line.containerId) {
                    await tx.container.update({
                        where: { id: line.containerId },
                        data: { locationId: movement.toLocationId },
                    });
                }
                await this.auditService.logEvent({
                    action: 'UPDATE_STOCK_FROM_MOVEMENT',
                    entity_type: 'stock_lines',
                    entity_id: updatedSource.id,
                    before: beforeSource,
                    after: updatedSource,
                    reason: 'Decrease stock from source location',
                });
                await this.auditService.logEvent({
                    action: 'UPDATE_STOCK_FROM_MOVEMENT',
                    entity_type: 'stock_lines',
                    entity_id: updatedDestination.id,
                    before: beforeDestination ??
                        {
                            productId: line.productId,
                            batchId: line.batchId,
                            locationId: movement.toLocationId,
                            containerId: line.containerId ?? null,
                            quantityBase: '0',
                        },
                    after: updatedDestination,
                    reason: 'Increase stock to destination location',
                });
            }
            const updatedMovement = await tx.movement.update({
                where: { id: movementInTx.id },
                data: { status: 'submitted' },
            });
            return { movement: updatedMovement };
        });
        await this.auditService.logEvent({
            action: 'SUBMIT_MOVEMENT',
            entity_type: 'movements',
            entity_id: movement.id,
            before: beforeMovement,
            after: response.movement,
            reason: 'Submit movement',
        });
        const threshold = capacityOverrideApplied
            ? { requiresApproval: false, snapshot: null }
            : await this.thresholdService.evaluate({
                actorUserId: movement.createdBy,
                documentType: 'movement',
                documentValue: movementValue,
                lines: lineThresholdInputs,
            });
        let approvalRequest = null;
        if (threshold.requiresApproval && threshold.snapshot) {
            approvalRequest = await this.approvalService.createApprovalRequest({
                actorUserId,
                documentType: 'movement',
                documentId: movement.id,
                thresholdSnapshot: threshold.snapshot,
            });
        }
        const finalResponse = {
            ...response,
            blocked: threshold.requiresApproval,
            approvalRequestId: approvalRequest?.id ?? null,
            capacityWarning,
            overrideRequired: false,
        };
        await this.idempotencyService.createWithResponse({
            actorUserId,
            route,
            key: idempotencyKey,
            requestBody: dto,
            responseJson: finalResponse,
        });
        return finalResponse;
    }
    async adminAdjustment(actorUserId, role, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (role !== 'admin') {
            throw new common_1.ForbiddenException('Chỉ admin được phép adjustment');
        }
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
        const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
        if (!product || !batch || !location) {
            throw new common_1.NotFoundException('product/batch/location không tồn tại');
        }
        if (dto.containerId) {
            const container = await this.prisma.container.findUnique({ where: { id: dto.containerId } });
            if (!container)
                throw new common_1.NotFoundException('Container không tồn tại');
        }
        const result = await this.adjustmentService.apply({
            productId: dto.productId,
            batchId: dto.batchId,
            locationId: dto.locationId,
            containerId: dto.containerId,
            newQuantityBase: dto.newQuantityBase,
            reason: dto.reason,
            action: 'ADMIN_ADJUSTMENT',
        });
        return result;
    }
};
exports.MovementService = MovementService;
exports.MovementService = MovementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [movement_repository_1.MovementRepository,
        prisma_service_1.PrismaService,
        context_service_1.ContextService,
        audit_service_1.AuditService,
        idempotency_service_1.IdempotencyService,
        approval_service_1.ApprovalService,
        threshold_service_1.ThresholdService,
        capacity_service_1.CapacityService,
        adjustment_service_1.AdjustmentService])
], MovementService);
//# sourceMappingURL=movement.service.js.map