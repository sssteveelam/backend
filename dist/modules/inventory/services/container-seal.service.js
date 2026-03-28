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
var ContainerSealService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerSealService = void 0;
const common_1 = require("@nestjs/common");
const approval_service_1 = require("../../approval/approval.service");
const threshold_service_1 = require("../../approval/threshold.service");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let ContainerSealService = ContainerSealService_1 = class ContainerSealService {
    constructor(prisma, thresholdService, approvalService, contextService, auditService) {
        this.prisma = prisma;
        this.thresholdService = thresholdService;
        this.approvalService = approvalService;
        this.contextService = contextService;
        this.auditService = auditService;
    }
    async openSeal(actorUserId, qrCode, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (!dto.reason?.trim())
            throw new common_1.BadRequestException('reason là bắt buộc');
        const container = await this.prisma.container.findUnique({
            where: { qrCode },
            include: {
                stockLines: {
                    include: {
                        batch: {
                            select: { averageCost: true },
                        },
                    },
                },
            },
        });
        if (!container)
            throw new common_1.NotFoundException('Container không tồn tại');
        if (!container.isSealed) {
            throw new common_1.ConflictException('CONTAINER_ALREADY_OPEN');
        }
        const containerTotalQty = container.stockLines.reduce((sum, x) => sum + Number(x.quantityBase), 0);
        const containerTotalValue = container.stockLines.reduce((sum, x) => sum + Number(x.quantityBase) * Number(x.batch.averageCost ?? 0), 0);
        const threshold = await this.thresholdService.evaluateOpenSeal({
            actorUserId,
            documentValue: containerTotalValue,
            totalQuantity: containerTotalQty,
            quantityThreshold: ContainerSealService_1.OPEN_SEAL_QTY_THRESHOLD,
            valueThreshold: ContainerSealService_1.OPEN_SEAL_VALUE_THRESHOLD,
        });
        await this.auditService.logEvent({
            action: 'OPEN_SEAL_REQUEST',
            entity_type: 'containers',
            entity_id: container.id,
            before: container,
            after: {
                blocked: threshold.requiresApproval,
                context: dto.context,
                reason: dto.reason,
                thresholdSnapshot: threshold.snapshot,
            },
            reason: dto.reason,
        });
        if (!threshold.requiresApproval) {
            const opened = await this.prisma.container.update({
                where: { id: container.id },
                data: {
                    isSealed: false,
                    sealedAt: null,
                    sealedBy: null,
                },
            });
            await this.auditService.logEvent({
                action: 'OPEN_SEAL_EXECUTED',
                entity_type: 'containers',
                entity_id: container.id,
                before: container,
                after: opened,
                reason: dto.reason,
            });
            return {
                blocked: false,
                container: opened,
            };
        }
        const approval = await this.approvalService.createApprovalRequest({
            actorUserId,
            documentType: 'open_seal',
            documentId: container.id,
            thresholdSnapshot: {
                ...threshold.snapshot,
                openSeal: {
                    context: dto.context,
                    reason: dto.reason,
                    qrCode,
                },
            },
            reason: dto.reason,
        });
        if (approval.status === 'approved') {
            const before = await this.prisma.container.findUnique({ where: { id: container.id } });
            if (before && before.isSealed) {
                const opened = await this.prisma.container.update({
                    where: { id: container.id },
                    data: {
                        isSealed: false,
                        sealedAt: null,
                        sealedBy: null,
                    },
                });
                await this.auditService.logEvent({
                    action: 'OPEN_SEAL_EXECUTED',
                    entity_type: 'containers',
                    entity_id: container.id,
                    before: before,
                    after: opened,
                    reason: dto.reason,
                });
                return {
                    blocked: false,
                    container: opened,
                    approvalRequestId: approval.id,
                };
            }
        }
        return {
            blocked: true,
            approvalRequestId: approval.id,
        };
    }
};
exports.ContainerSealService = ContainerSealService;
ContainerSealService.OPEN_SEAL_VALUE_THRESHOLD = 1_000_000;
ContainerSealService.OPEN_SEAL_QTY_THRESHOLD = 20;
exports.ContainerSealService = ContainerSealService = ContainerSealService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        threshold_service_1.ThresholdService,
        approval_service_1.ApprovalService,
        context_service_1.ContextService,
        audit_service_1.AuditService])
], ContainerSealService);
//# sourceMappingURL=container-seal.service.js.map