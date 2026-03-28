import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async createApprovalRequest(input: {
    actorUserId: string;
    documentType: 'receipt' | 'movement' | 'open_seal' | 'cycle_count';
    documentId: string;
    thresholdSnapshot: Prisma.InputJsonValue;
    reason?: string;
    poCode?: string;
  }) {
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

  listApprovals(status?: string) {
    return this.prisma.approvalRequest.findMany({
      where: {
        status: status ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveApprovalRequest(actorUserId: string, approvalId: string, poCode?: string) {
    this.contextService.setActorUserId(actorUserId);

    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval request không tồn tại');
    if (approval.status !== 'pending') {
      throw new ConflictException('Approval request không ở trạng thái pending');
    }

    const snapshot = approval.thresholdSnapshot as {
      evaluated_result?: { poCodeRequired?: boolean };
    };
    const poCodeRequired = Boolean(snapshot?.evaluated_result?.poCodeRequired);
    const nextPoCode = poCode ?? approval.poCode ?? null;

    if (poCodeRequired && !nextPoCode) {
      throw new BadRequestException('PO_CODE_REQUIRED');
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

  async rejectApprovalRequest(actorUserId: string, approvalId: string, reason: string) {
    this.contextService.setActorUserId(actorUserId);

    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval request không tồn tại');
    if (approval.status !== 'pending') {
      throw new ConflictException('Approval request không ở trạng thái pending');
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

  private async ensureDocumentExists(
    documentType: 'receipt' | 'movement' | 'open_seal' | 'cycle_count',
    documentId: string,
  ): Promise<void> {
    if (documentType === 'receipt') {
      const receipt = await this.prisma.receipt.findUnique({ where: { id: documentId } });
      if (!receipt) throw new NotFoundException('Receipt không tồn tại');
      return;
    }

    if (documentType === 'open_seal') {
      const container = await this.prisma.container.findUnique({ where: { id: documentId } });
      if (!container) throw new NotFoundException('Container không tồn tại');
      return;
    }

    if (documentType === 'cycle_count') {
      const cycleCount = await this.prisma.cycleCount.findUnique({ where: { id: documentId } });
      if (!cycleCount) throw new NotFoundException('Cycle count không tồn tại');
      return;
    }

    const movement = await this.prisma.movement.findUnique({ where: { id: documentId } });
    if (!movement) throw new NotFoundException('Movement không tồn tại');
  }
}
