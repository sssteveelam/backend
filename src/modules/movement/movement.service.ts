import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { ApprovalService } from '../approval/approval.service';
import { ThresholdService } from '../approval/threshold.service';
import { AppRole } from '../auth/guards/roles.guard';
import { CapacityService } from '../capacity/capacity.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddMovementLineDto } from './dto/add-movement-line.dto';
import { AdminAdjustmentDto } from './dto/admin-adjustment.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { SubmitMovementDto } from './dto/submit-movement.dto';
import { MovementRepository } from './movement.repository';
import { AdjustmentService } from './adjustment.service';
import { MovementListQueryDto } from './dto/movement-list-query.dto';
import { ListResponse, buildListResponse } from '../../common/dto/list-response.dto';
import { getPaginationSkipTake } from '../../common/dto/pagination-query.dto';
import { MovementListItemDto } from './dto/movement-list-item.dto';
import { MovementDetailDto } from './dto/movement-detail.dto';
import { MovementLineDto } from './dto/movement-line.dto';

@Injectable()
export class MovementService {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
    private readonly approvalService: ApprovalService,
    private readonly thresholdService: ThresholdService,
    private readonly capacityService: CapacityService,
    private readonly adjustmentService: AdjustmentService,
  ) {}

  // PROPOSED NEW API: GET /movements
  async listMovements(query: MovementListQueryDto): Promise<ListResponse<MovementListItemDto>> {
    if (query.createdFrom && query.createdTo) {
      const from = new Date(query.createdFrom);
      const to = new Date(query.createdTo);
      if (from > to) {
        throw new BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
      }
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.movementRepository.listMovements(query, skip, take);

    return buildListResponse({
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

  // PROPOSED NEW API: GET /movements/:id
  async getMovementDetail(movementId: string): Promise<MovementDetailDto> {
    const movement = await this.movementRepository.findMovementWithLinesById(movementId);
    if (!movement) {
      throw new NotFoundException('Movement không tồn tại');
    }

    const lines: MovementLineDto[] = movement.lines.map((line) => ({
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

  private ensureScanOrder(dto: SubmitMovementDto): void {
    if (
      !Array.isArray(dto.scanSequence) ||
      dto.scanSequence.length !== 2 ||
      dto.scanSequence[0] !== 'container' ||
      dto.scanSequence[1] !== 'location'
    ) {
      throw new BadRequestException('INVALID_SCAN_ORDER');
    }
  }

  async createMovement(actorUserId: string, dto: CreateMovementDto) {
    this.contextService.setActorUserId(actorUserId);

    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('from_location và to_location không được trùng');
    }

    const fromLocation = await this.prisma.location.findUnique({ where: { id: dto.fromLocationId } });
    const toLocation = await this.prisma.location.findUnique({ where: { id: dto.toLocationId } });
    if (!fromLocation || !toLocation) {
      throw new NotFoundException('Location không tồn tại');
    }

    const existed = await this.movementRepository.findMovementByCode(dto.code);
    if (existed) throw new ConflictException('Movement code đã tồn tại');

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

  async addLine(actorUserId: string, movementId: string, dto: AddMovementLineDto) {
    this.contextService.setActorUserId(actorUserId);

    if (dto.quantityBase <= 0) {
      throw new BadRequestException('quantity_base phải > 0');
    }

    const movement = await this.movementRepository.findMovementById(movementId);
    if (!movement) throw new NotFoundException('Movement không tồn tại');
    if (movement.status !== 'draft') throw new ForbiddenException('Chỉ thêm line khi movement draft');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!product || !batch) throw new NotFoundException('Product hoặc batch không tồn tại');

    if (dto.containerId) {
      const container = await this.prisma.container.findUnique({ where: { id: dto.containerId } });
      if (!container) throw new NotFoundException('Container không tồn tại');
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

  async submitMovement(
    actorUserId: string,
    actorRole: AppRole,
    movementId: string,
    idempotencyKey: string,
    dto: SubmitMovementDto,
  ) {
    this.contextService.setActorUserId(actorUserId);

    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key là bắt buộc');

    const route = `/movements/${movementId}/submit`;
    const idem = await this.idempotencyService.findOne({ actorUserId, route, key: idempotencyKey });
    if (idem) {
      const currentRequestHash = this.idempotencyService.hashRequestBody(dto);
      if (idem.requestHash !== currentRequestHash) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      }
      if (idem.responseJson) {
        return idem.responseJson;
      }
    }

    const movement = await this.movementRepository.findMovementById(movementId);
    if (!movement) throw new NotFoundException('Movement không tồn tại');
    if (movement.status === 'submitted') throw new ConflictException('Movement đã submit');
    if (actorRole === 'staff' && !dto.overrideCapacity) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    this.ensureScanOrder(dto);

    const lines = await this.movementRepository.findMovementLines(movementId);
    if (lines.length === 0) throw new BadRequestException('Movement chưa có line');
    const currentToLocationStock = await this.prisma.stockLine.aggregate({
      where: { locationId: movement.toLocationId },
      _sum: { quantityBase: true },
    });
    const toLocation = await this.prisma.location.findUnique({ where: { id: movement.toLocationId } });
    if (!toLocation) throw new NotFoundException('Location không tồn tại');
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
        throw new BadRequestException('CAPACITY_OVERRIDE_REASON_REQUIRED');
      }

      if (actorRole === 'staff' && capacityResult.isBigOver) {
        throw new ForbiddenException('BIG_OVER_REQUIRES_APPROVAL');
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
    const lineThresholdInputs = await Promise.all(
      lines.map(async (line) => {
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
      }),
    );
    const movementValue = await Promise.all(
      lines.map(async (line) => {
        const batch = await this.prisma.batch.findUnique({
          where: { id: line.batchId },
          select: { averageCost: true },
        });
        return Number(line.quantityBase) * Number(batch?.averageCost ?? 0);
      }),
    ).then((values) => values.reduce((sum, value) => sum + value, 0));

    const beforeMovement = movement;

    const response = await this.movementRepository.withTransaction(async (tx) => {
      const movementInTx = await tx.movement.findUnique({ where: { id: movement.id } });
      if (!movementInTx) throw new NotFoundException('Movement không tồn tại');
      if (movementInTx.status === 'submitted') throw new ConflictException('Movement đã submit');

      const scannedContainer = await tx.container.findUnique({ where: { id: dto.scannedContainerId } });
      if (!scannedContainer || scannedContainer.qrCode !== dto.scannedContainerQr) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
      }
      const movementContainerIds = lines
        .map((line) => line.containerId)
        .filter((containerId): containerId is string => Boolean(containerId));
      if (movementContainerIds.length > 0 && !movementContainerIds.includes(scannedContainer.id)) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
      }

      const scannedLocation = await tx.location.findUnique({ where: { id: dto.scannedLocationId } });
      if (!scannedLocation || scannedLocation.code !== dto.scannedLocationQr) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
      }

      if (movement.toLocationId !== scannedLocation.id) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
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

        if (!source) throw new BadRequestException('Không tồn tại tồn kho tại source location');

        if (line.quantityBase.gt(source.quantityBase)) {
          throw new BadRequestException('Không đủ tồn để movement');
        }

        const nextSourceQty = new Prisma.Decimal(source.quantityBase).minus(line.quantityBase);
        if (nextSourceQty.lt(0)) {
          throw new BadRequestException('Không cho phép âm tồn');
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
              quantityBase: new Prisma.Decimal(destination.quantityBase).plus(line.quantityBase),
            },
          });
        } else {
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
          before:
            beforeDestination ??
            ({
              productId: line.productId,
              batchId: line.batchId,
              locationId: movement.toLocationId,
              containerId: line.containerId ?? null,
              quantityBase: '0',
            } as Prisma.InputJsonValue),
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

  async adminAdjustment(actorUserId: string, role: string, dto: AdminAdjustmentDto) {
    this.contextService.setActorUserId(actorUserId);

    if (role !== 'admin') {
      throw new ForbiddenException('Chỉ admin được phép adjustment');
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!product || !batch || !location) {
      throw new NotFoundException('product/batch/location không tồn tại');
    }

    if (dto.containerId) {
      const container = await this.prisma.container.findUnique({ where: { id: dto.containerId } });
      if (!container) throw new NotFoundException('Container không tồn tại');
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
}
