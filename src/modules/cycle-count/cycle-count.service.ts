import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Prisma } from '@prisma/client';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { AdjustmentService } from '../movement/adjustment.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddCycleCountLineDto } from './dto/add-cycle-count-line.dto';
import { CycleCountDetailDto } from './dto/cycle-count-detail.dto';
import { CycleCountLineDto } from './dto/cycle-count-line.dto';
import { CycleCountListItemDto } from './dto/cycle-count-list-item.dto';
import { CycleCountListQueryDto } from './dto/cycle-count-list-query.dto';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import { SubmitCycleCountDto } from './dto/submit-cycle-count.dto';
import { CycleCountRepository } from './cycle-count.repository';
import { buildListResponse, ListResponse } from '../../common/dto/list-response.dto';
import { getPaginationSkipTake } from '../../common/dto/pagination-query.dto';

@Injectable()
export class CycleCountService {
  constructor(
    private readonly cycleCountRepository: CycleCountRepository,
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
    private readonly adjustmentService: AdjustmentService,
    private readonly approvalService: ApprovalService,
  ) {}

  // PROPOSED NEW API: GET /cycle-counts
  async listCycleCounts(query: CycleCountListQueryDto): Promise<ListResponse<CycleCountListItemDto>> {
    if (query.createdFrom && query.createdTo) {
      const from = new Date(query.createdFrom);
      const to = new Date(query.createdTo);
      if (from > to) {
        throw new BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
      }
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.cycleCountRepository.listCycleCounts(query, skip, take);

    return buildListResponse({
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

  // PROPOSED NEW API: GET /cycle-counts/:id
  async getCycleCountDetail(cycleCountId: string): Promise<CycleCountDetailDto> {
    if (!isUUID(cycleCountId)) {
      throw new BadRequestException('cycleCountId không hợp lệ');
    }

    const cycleCount = await this.cycleCountRepository.findCycleCountWithLinesById(cycleCountId);
    if (!cycleCount) throw new NotFoundException('Cycle count không tồn tại');

    const lines: CycleCountLineDto[] = cycleCount.lines.map((line) => ({
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

  async create(actorUserId: string, dto: CreateCycleCountDto) {
    this.contextService.setActorUserId(actorUserId);

    const duplicated = await this.cycleCountRepository.findByCode(dto.code);
    if (duplicated) throw new ConflictException('Cycle count code đã tồn tại');

    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!location) throw new NotFoundException('Location không tồn tại');

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

  async addLine(actorUserId: string, cycleCountId: string, dto: AddCycleCountLineDto) {
    this.contextService.setActorUserId(actorUserId);

    const cycleCount = await this.cycleCountRepository.findById(cycleCountId);
    if (!cycleCount) throw new NotFoundException('Cycle count không tồn tại');
    if (cycleCount.status !== 'draft') throw new BadRequestException('Chỉ thêm line khi cycle count draft');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!product || !batch) throw new NotFoundException('Product hoặc batch không tồn tại');

    if (dto.scanSequence) {
      const valid =
        (dto.scanSequence[0] === 'location' && dto.scanSequence[1] === 'container') ||
        (dto.scanSequence[0] === 'container' && dto.scanSequence[1] === 'location');
      if (!valid) throw new BadRequestException('INVALID_SCAN_ORDER');
    }

    if (dto.scannedLocationId && dto.scannedLocationId !== cycleCount.locationId) {
      throw new BadRequestException('SCANNED_LOCATION_MISMATCH');
    }

    if (dto.containerId || dto.scannedContainerId) {
      const containerId = dto.containerId ?? dto.scannedContainerId!;
      const container = await this.prisma.container.findUnique({ where: { id: containerId } });
      if (!container) throw new NotFoundException('Container không tồn tại');
      if (container.locationId !== cycleCount.locationId) {
        throw new BadRequestException('CONTAINER_NOT_IN_LOCATION');
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

  async submit(actorUserId: string, cycleCountId: string, dto: SubmitCycleCountDto) {
    this.contextService.setActorUserId(actorUserId);

    const cycleCount = await this.cycleCountRepository.findById(cycleCountId);
    if (!cycleCount) throw new NotFoundException('Cycle count không tồn tại');
    if (cycleCount.status === 'submitted') throw new ConflictException('Cycle count đã submit');

    const lines = await this.cycleCountRepository.findLines(cycleCountId);
    if (lines.length === 0) throw new BadRequestException('Cycle count chưa có line');

    const deltaRows = await Promise.all(
      lines.map(async (line) => {
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
      }),
    );

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
        } as Prisma.InputJsonValue,
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
        if (row.delta === 0) continue;
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
}
