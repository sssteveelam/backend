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
exports.CycleCountService = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const approval_service_1 = require("../approval/approval.service");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const adjustment_service_1 = require("../movement/adjustment.service");
const prisma_service_1 = require("../prisma/prisma.service");
const cycle_count_repository_1 = require("./cycle-count.repository");
const list_response_dto_1 = require("../../common/dto/list-response.dto");
const pagination_query_dto_1 = require("../../common/dto/pagination-query.dto");
let CycleCountService = class CycleCountService {
    constructor(cycleCountRepository, prisma, contextService, auditService, adjustmentService, approvalService) {
        this.cycleCountRepository = cycleCountRepository;
        this.prisma = prisma;
        this.contextService = contextService;
        this.auditService = auditService;
        this.adjustmentService = adjustmentService;
        this.approvalService = approvalService;
    }
    async listCycleCounts(query) {
        if (query.createdFrom && query.createdTo) {
            const from = new Date(query.createdFrom);
            const to = new Date(query.createdTo);
            if (from > to) {
                throw new common_1.BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
            }
        }
        const { skip, take } = (0, pagination_query_dto_1.getPaginationSkipTake)({ page: query.page, limit: query.limit });
        const { rows, total } = await this.cycleCountRepository.listCycleCounts(query, skip, take);
        return (0, list_response_dto_1.buildListResponse)({
            data: rows.map((row) => ({
                id: row.id,
                code: row.code,
                status: row.status,
                locationId: row.locationId,
                createdBy: row.createdBy,
                createdAt: row.createdAt.toISOString(),
            })),
            page: query.page,
            limit: query.limit,
            total,
        });
    }
    async getCycleCountDetail(cycleCountId) {
        if (!(0, class_validator_1.isUUID)(cycleCountId)) {
            throw new common_1.BadRequestException('cycleCountId không hợp lệ');
        }
        const cycleCount = await this.cycleCountRepository.findCycleCountWithLinesById(cycleCountId);
        if (!cycleCount)
            throw new common_1.NotFoundException('Cycle count không tồn tại');
        const lines = cycleCount.lines.map((line) => ({
            id: line.id,
            cycleCountId: line.cycleCountId,
            productId: line.productId,
            batchId: line.batchId,
            containerId: line.containerId,
            countedQuantity: line.countedQuantity.toString(),
            createdAt: line.createdAt.toISOString(),
        }));
        return {
            id: cycleCount.id,
            code: cycleCount.code,
            status: cycleCount.status,
            locationId: cycleCount.locationId,
            createdBy: cycleCount.createdBy,
            createdAt: cycleCount.createdAt.toISOString(),
            lines,
        };
    }
    async create(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const duplicated = await this.cycleCountRepository.findByCode(dto.code);
        if (duplicated)
            throw new common_1.ConflictException('Cycle count code đã tồn tại');
        const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
        if (!location)
            throw new common_1.NotFoundException('Location không tồn tại');
        const created = await this.cycleCountRepository.createCycleCount({
            code: dto.code,
            status: 'draft',
            location: { connect: { id: dto.locationId } },
            creator: { connect: { id: actorUserId } },
        });
        await this.auditService.logEvent({
            action: 'CREATE_CYCLE_COUNT',
            entity_type: 'cycle_counts',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Create cycle count draft',
        });
        return created;
    }
    async addLine(actorUserId, cycleCountId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const cycleCount = await this.cycleCountRepository.findById(cycleCountId);
        if (!cycleCount)
            throw new common_1.NotFoundException('Cycle count không tồn tại');
        if (cycleCount.status !== 'draft')
            throw new common_1.BadRequestException('Chỉ thêm line khi cycle count draft');
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
        if (!product || !batch)
            throw new common_1.NotFoundException('Product hoặc batch không tồn tại');
        if (dto.scanSequence) {
            const valid = (dto.scanSequence[0] === 'location' && dto.scanSequence[1] === 'container') ||
                (dto.scanSequence[0] === 'container' && dto.scanSequence[1] === 'location');
            if (!valid)
                throw new common_1.BadRequestException('INVALID_SCAN_ORDER');
        }
        if (dto.scannedLocationId && dto.scannedLocationId !== cycleCount.locationId) {
            throw new common_1.BadRequestException('SCANNED_LOCATION_MISMATCH');
        }
        if (dto.containerId || dto.scannedContainerId) {
            const containerId = dto.containerId ?? dto.scannedContainerId;
            const container = await this.prisma.container.findUnique({ where: { id: containerId } });
            if (!container)
                throw new common_1.NotFoundException('Container không tồn tại');
            if (container.locationId !== cycleCount.locationId) {
                throw new common_1.BadRequestException('CONTAINER_NOT_IN_LOCATION');
            }
        }
        const created = await this.cycleCountRepository.createLine({
            countedQuantity: dto.countedQuantity,
            cycleCount: { connect: { id: cycleCountId } },
            product: { connect: { id: dto.productId } },
            batch: { connect: { id: dto.batchId } },
            container: dto.containerId ? { connect: { id: dto.containerId } } : undefined,
        });
        await this.auditService.logEvent({
            action: 'ADD_CYCLE_COUNT_LINE',
            entity_type: 'cycle_count_lines',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Add cycle count line',
        });
        return created;
    }
    async submit(actorUserId, cycleCountId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const cycleCount = await this.cycleCountRepository.findById(cycleCountId);
        if (!cycleCount)
            throw new common_1.NotFoundException('Cycle count không tồn tại');
        if (cycleCount.status === 'submitted')
            throw new common_1.ConflictException('Cycle count đã submit');
        const lines = await this.cycleCountRepository.findLines(cycleCountId);
        if (lines.length === 0)
            throw new common_1.BadRequestException('Cycle count chưa có line');
        const deltaRows = await Promise.all(lines.map(async (line) => {
            const stockLine = await this.prisma.stockLine.findFirst({
                where: {
                    locationId: cycleCount.locationId,
                    productId: line.productId,
                    batchId: line.batchId,
                    containerId: line.containerId ?? null,
                },
            });
            const expectedQuantity = Number(stockLine?.quantityBase ?? 0);
            const countedQuantity = Number(line.countedQuantity);
            const delta = countedQuantity - expectedQuantity;
            return {
                lineId: line.id,
                productId: line.productId,
                batchId: line.batchId,
                containerId: line.containerId,
                expectedQuantity,
                countedQuantity,
                delta,
            };
        }));
        const approvalDeltaThreshold = Number(process.env.CYCLE_COUNT_APPROVAL_DELTA_THRESHOLD ?? 0);
        const maxAbsDelta = deltaRows.reduce((max, row) => Math.max(max, Math.abs(row.delta)), 0);
        if (approvalDeltaThreshold > 0 && maxAbsDelta > approvalDeltaThreshold) {
            const approvalRequest = await this.approvalService.createApprovalRequest({
                actorUserId,
                documentType: 'cycle_count',
                documentId: cycleCount.id,
                thresholdSnapshot: {
                    cycleCount: {
                        approvalDeltaThreshold,
                        maxAbsDelta,
                        rows: deltaRows,
                    },
                },
                reason: 'Cycle count delta exceeds threshold',
            });
            return {
                blocked: true,
                approvalRequestId: approvalRequest.id,
            };
        }
        const beforeCycleCount = cycleCount;
        const submitted = await this.cycleCountRepository.withTransaction(async (tx) => {
            for (const row of deltaRows) {
                if (row.delta === 0)
                    continue;
                await this.adjustmentService.applyWithTransaction(tx, {
                    productId: row.productId,
                    batchId: row.batchId,
                    locationId: cycleCount.locationId,
                    containerId: row.containerId ?? undefined,
                    newQuantityBase: row.countedQuantity,
                    action: 'APPLY_ADJUSTMENT_FROM_COUNT',
                    reason: dto.reason ?? 'cycle_count',
                    extraAfter: {
                        cycleCountId: cycleCount.id,
                        cycleCountLineId: row.lineId,
                        expectedQuantity: row.expectedQuantity,
                        countedQuantity: row.countedQuantity,
                        delta: row.delta,
                    },
                });
            }
            return tx.cycleCount.update({
                where: { id: cycleCount.id },
                data: { status: 'submitted' },
            });
        });
        await this.auditService.logEvent({
            action: 'SUBMIT_CYCLE_COUNT',
            entity_type: 'cycle_counts',
            entity_id: cycleCount.id,
            before: beforeCycleCount,
            after: {
                ...submitted,
                deltas: deltaRows,
            },
            reason: dto.reason ?? 'cycle_count',
        });
        return {
            blocked: false,
            approvalRequestId: null,
            cycleCount: submitted,
            deltas: deltaRows,
        };
    }
};
exports.CycleCountService = CycleCountService;
exports.CycleCountService = CycleCountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cycle_count_repository_1.CycleCountRepository,
        prisma_service_1.PrismaService,
        context_service_1.ContextService,
        audit_service_1.AuditService,
        adjustment_service_1.AdjustmentService,
        approval_service_1.ApprovalService])
], CycleCountService);
//# sourceMappingURL=cycle-count.service.js.map