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
exports.ApprovalService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const prisma_service_1 = require("../prisma/prisma.service");
let ApprovalService = class ApprovalService {
    constructor(prisma, auditService, contextService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async createApprovalRequest(input) {
        this.contextService.setActorUserId(input.actorUserId);
        await this.ensureDocumentExists(input.documentType, input.documentId);
        const existing = await this.prisma.approvalRequest.findUnique({
            where: {
                documentType_documentId: {
                    documentType: input.documentType,
                    documentId: input.documentId,
                },
            },
        });
        if (existing) {
            return existing;
        }
        const created = await this.prisma.approvalRequest.create({
            data: {
                documentType: input.documentType,
                documentId: input.documentId,
                status: 'pending',
                reason: input.reason,
                poCode: input.poCode,
                thresholdSnapshot: input.thresholdSnapshot,
                requestedBy: input.actorUserId,
            },
        });
        await this.auditService.logEvent({
            action: 'CREATE_APPROVAL_REQUEST',
            entity_type: 'approval_requests',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Threshold exceeded; approval required',
        });
        return created;
    }
    listApprovals(status) {
        return this.prisma.approvalRequest.findMany({
            where: {
                status: status ?? undefined,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async approveApprovalRequest(actorUserId, approvalId, poCode) {
        this.contextService.setActorUserId(actorUserId);
        const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
        if (!approval)
            throw new common_1.NotFoundException('Approval request không tồn tại');
        if (approval.status !== 'pending') {
            throw new common_1.ConflictException('Approval request không ở trạng thái pending');
        }
        const snapshot = approval.thresholdSnapshot;
        const poCodeRequired = Boolean(snapshot?.evaluated_result?.poCodeRequired);
        const nextPoCode = poCode ?? approval.poCode ?? null;
        if (poCodeRequired && !nextPoCode) {
            throw new common_1.BadRequestException('PO_CODE_REQUIRED');
        }
        const before = approval;
        const updated = await this.prisma.approvalRequest.update({
            where: { id: approvalId },
            data: {
                status: 'approved',
                poCode: nextPoCode,
                decidedBy: actorUserId,
                decidedAt: new Date(),
            },
        });
        await this.auditService.logEvent({
            action: approval.documentType === 'open_seal' ? 'OPEN_SEAL_APPROVED' : 'APPROVE_REQUEST',
            entity_type: 'approval_requests',
            entity_id: updated.id,
            before,
            after: updated,
            reason: 'Approval decision: approved',
        });
        if (approval.documentType === 'open_seal') {
            const containerBefore = await this.prisma.container.findUnique({
                where: { id: approval.documentId },
            });
            if (containerBefore && containerBefore.isSealed) {
                const containerAfter = await this.prisma.container.update({
                    where: { id: containerBefore.id },
                    data: {
                        isSealed: false,
                        sealedAt: null,
                        sealedBy: null,
                    },
                });
                await this.auditService.logEvent({
                    action: 'OPEN_SEAL_EXECUTED',
                    entity_type: 'containers',
                    entity_id: containerAfter.id,
                    before: containerBefore,
                    after: containerAfter,
                    reason: approval.reason ?? 'Open seal executed after approval',
                });
            }
        }
        return updated;
    }
    async rejectApprovalRequest(actorUserId, approvalId, reason) {
        this.contextService.setActorUserId(actorUserId);
        const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
        if (!approval)
            throw new common_1.NotFoundException('Approval request không tồn tại');
        if (approval.status !== 'pending') {
            throw new common_1.ConflictException('Approval request không ở trạng thái pending');
        }
        const before = approval;
        const updated = await this.prisma.approvalRequest.update({
            where: { id: approvalId },
            data: {
                status: 'rejected',
                reason,
                decidedBy: actorUserId,
                decidedAt: new Date(),
            },
        });
        await this.auditService.logEvent({
            action: 'REJECT_REQUEST',
            entity_type: 'approval_requests',
            entity_id: updated.id,
            before,
            after: updated,
            reason,
        });
        return updated;
    }
    async ensureDocumentExists(documentType, documentId) {
        if (documentType === 'receipt') {
            const receipt = await this.prisma.receipt.findUnique({ where: { id: documentId } });
            if (!receipt)
                throw new common_1.NotFoundException('Receipt không tồn tại');
            return;
        }
        if (documentType === 'open_seal') {
            const container = await this.prisma.container.findUnique({ where: { id: documentId } });
            if (!container)
                throw new common_1.NotFoundException('Container không tồn tại');
            return;
        }
        if (documentType === 'cycle_count') {
            const cycleCount = await this.prisma.cycleCount.findUnique({ where: { id: documentId } });
            if (!cycleCount)
                throw new common_1.NotFoundException('Cycle count không tồn tại');
            return;
        }
        const movement = await this.prisma.movement.findUnique({ where: { id: documentId } });
        if (!movement)
            throw new common_1.NotFoundException('Movement không tồn tại');
    }
};
exports.ApprovalService = ApprovalService;
exports.ApprovalService = ApprovalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], ApprovalService);
//# sourceMappingURL=approval.service.js.map