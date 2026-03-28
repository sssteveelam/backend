import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApprovalService } from '../../approval/approval.service';
import { ThresholdService } from '../../approval/threshold.service';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenSealDto } from '../dto/open-seal.dto';

@Injectable()
export class ContainerSealService {
  private static readonly OPEN_SEAL_VALUE_THRESHOLD = 1_000_000;
  private static readonly OPEN_SEAL_QTY_THRESHOLD = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly thresholdService: ThresholdService,
    private readonly approvalService: ApprovalService,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
  ) {}

  async openSeal(actorUserId: string, qrCode: string, dto: OpenSealDto) {
    this.contextService.setActorUserId(actorUserId);
    if (!dto.reason?.trim()) throw new BadRequestException('reason là bắt buộc');

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
    if (!container) throw new NotFoundException('Container không tồn tại');
    if (!container.isSealed) {
      throw new ConflictException('CONTAINER_ALREADY_OPEN');
    }

    const containerTotalQty = container.stockLines.reduce((sum, x) => sum + Number(x.quantityBase), 0);
    const containerTotalValue = container.stockLines.reduce(
      (sum, x) => sum + Number(x.quantityBase) * Number(x.batch.averageCost ?? 0),
      0,
    );

    const threshold = await this.thresholdService.evaluateOpenSeal({
      actorUserId,
      documentValue: containerTotalValue,
      totalQuantity: containerTotalQty,
      quantityThreshold: ContainerSealService.OPEN_SEAL_QTY_THRESHOLD,
      valueThreshold: ContainerSealService.OPEN_SEAL_VALUE_THRESHOLD,
    });

    await this.auditService.logEvent({
      action: 'OPEN_SEAL_REQUEST',
      entity_type: 'containers',
      entity_id: container.id,
      before: container as unknown as Prisma.InputJsonValue,
      after: {
        blocked: threshold.requiresApproval,
        context: dto.context,
        reason: dto.reason,
        thresholdSnapshot: threshold.snapshot,
      } as unknown as Prisma.InputJsonValue,
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
        before: container as unknown as Prisma.InputJsonValue,
        after: opened as unknown as Prisma.InputJsonValue,
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
          before: before as unknown as Prisma.InputJsonValue,
          after: opened as unknown as Prisma.InputJsonValue,
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
}
