import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppTimeoutConfigService } from '../config/app-timeout-config.service';
import { ContextService } from '../context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { PlanPicksDto } from './dto/plan-picks.dto';
import { IssueRepository } from './issue.repository';
import { IssueListQueryDto } from './dto/issue-list-query.dto';
import { ListResponse, buildListResponse } from '../../common/dto/list-response.dto';
import { getPaginationSkipTake } from '../../common/dto/pagination-query.dto';
import { IssueListItemDto } from './dto/issue-list-item.dto';
import { IssueDetailDto, IssueLineDto } from './dto/issue-detail.dto';
import { PickTaskListQueryDto } from './dto/pick-task-list-query.dto';
import { PickTaskListItemDto } from './dto/pick-task-list-item.dto';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
type StockCandidate = {
  productId: string;
  batchId: string;
  locationId: string;
  containerId: string | null;
  quantityBase: Prisma.Decimal;
  batch: {
    expiryDate: Date;
  };
};

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issueRepository: IssueRepository,
    private readonly reservationService: ReservationService,
    private readonly appTimeoutConfigService: AppTimeoutConfigService,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  // PROPOSED NEW API: GET /issues
  async listIssues(query: IssueListQueryDto): Promise<ListResponse<IssueListItemDto>> {
    if (query.createdFrom && query.createdTo) {
      const from = new Date(query.createdFrom);
      const to = new Date(query.createdTo);
      if (from > to) {
        throw new BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
      }
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.issueRepository.listIssues(query, skip, take);

    return buildListResponse({
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
    });
  }

  // PROPOSED NEW API: GET /issues/:id
  async getIssueDetail(issueId: string): Promise<IssueDetailDto> {
    const issue = await this.issueRepository.findIssueWithLinesById(issueId);
    if (!issue) {
      throw new NotFoundException('Issue không tồn tại');
    }

    const lines: IssueLineDto[] = issue.lines.map((line) => ({
      id: line.id,
      issueId: line.issueId,
      productId: line.productId,
      quantityBase: line.quantityBase.toString(),
      createdAt: line.createdAt.toISOString(),
    }));

    return {
      id: issue.id,
      code: issue.code,
      status: issue.status,
      createdBy: issue.createdBy,
      createdAt: issue.createdAt.toISOString(),
      lines,
    };
  }

  // PROPOSED NEW API: GET /issues/:id/pick-tasks
  async listPickTasksByIssue(issueId: string, query: PickTaskListQueryDto): Promise<ListResponse<PickTaskListItemDto>> {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } });
    if (!issue) {
      throw new NotFoundException('Issue không tồn tại');
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.issueRepository.listPickTasksByIssue(issueId, query, skip, take);

    return buildListResponse({
      data: rows.map((row) => ({
        id: row.id,
        issueLineId: row.issueLineId,
        productId: row.productId,
        batchId: row.batchId,
        locationId: row.locationId,
        containerId: row.containerId,
        reservationId: row.reservationId,
        quantityBase: row.quantityBase.toString(),
        pickedQuantity: row.pickedQuantity.toString(),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
    });
  }

  async createIssue(actorUserId: string, dto: CreateIssueDto) {
    this.contextService.setActorUserId(actorUserId);
    if (dto.lines.length === 0) throw new BadRequestException('Issue phải có ít nhất 1 line');

    const existed = await this.prisma.issue.findUnique({ where: { code: dto.code } });
    if (existed) throw new ConflictException('Issue code đã tồn tại');

    const productIds = [...new Set(dto.lines.map((x) => x.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Có product không tồn tại');
    }

    const created = await this.issueRepository.withTransaction(async (tx) => {
      return tx.issue.create({
        data: {
          code: dto.code,
          status: 'draft',
          createdBy: actorUserId,
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              quantityBase: line.quantityBase,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.auditService.logEvent({
      action: 'CREATE_ISSUE',
      entity_type: 'issues',
      entity_id: created.id,
      before: null,
      after: created as unknown as Prisma.InputJsonValue,
      reason: 'Create issue draft',
    });

    return created;
  }

  async planPicks(actorUserId: string, issueId: string, dto: PlanPicksDto) {
    this.contextService.setActorUserId(actorUserId);

    const response = await this.issueRepository.withTransaction(async (tx) => {
      const issue = await tx.issue.findUnique({
        where: { id: issueId },
        include: { lines: true },
      });
      if (!issue) throw new NotFoundException('Issue không tồn tại');
      if (issue.status !== 'draft') throw new ConflictException('Chỉ plan picks khi issue ở draft');
      if (issue.lines.length === 0) throw new BadRequestException('Issue chưa có line');

      await tx.pickTask.deleteMany({
        where: {
          issueLine: { issueId: issue.id },
        },
      });

      const warnings: string[] = [];
      const byLine = new Map<string, Array<NonNullable<PlanPicksDto['overrides']>[number]>>();
      for (const override of dto.overrides ?? []) {
        const group = byLine.get(override.issueLineId) ?? [];
        group.push(override);
        byLine.set(override.issueLineId, group);
      }

      const tasks: Prisma.PickTaskUncheckedCreateInput[] = [];
      for (const line of issue.lines) {
        const allStocks = await this.getStockCandidates(tx, line.productId);
        const lineOverrides = byLine.get(line.id) ?? [];
        const overrideTotal = lineOverrides.reduce((sum, o) => sum + o.quantityBase, 0);
        if (overrideTotal > Number(line.quantityBase)) {
          throw new BadRequestException('Override quantity vượt quá issue_line.quantity_base');
        }

        const earliest = allStocks.length > 0 ? allStocks[0].batch.expiryDate.getTime() : null;
        const remainMap = new Map(
          allStocks.map((s) => [this.stockKey(s), Number(s.quantityBase)]),
        );

        for (const override of lineOverrides) {
          const stock = allStocks.find(
            (x) =>
              x.batchId === override.batchId &&
              x.locationId === override.locationId &&
              (x.containerId ?? null) === (override.containerId ?? null),
          );
          if (!stock) throw new BadRequestException('Override candidate không tồn tại trong inventory');
          const key = this.stockKey(stock);
          const remain = remainMap.get(key) ?? 0;
          if (override.quantityBase > remain) {
            throw new BadRequestException('Override quantity vượt tồn khả dụng candidate');
          }
          remainMap.set(key, remain - override.quantityBase);
          tasks.push({
            issueLineId: line.id,
            productId: line.productId,
            batchId: stock.batchId,
            locationId: stock.locationId,
            containerId: stock.containerId,
            quantityBase: override.quantityBase,
            pickedQuantity: 0,
            status: 'pending',
          });
          if (earliest !== null && stock.batch.expiryDate.getTime() > earliest) {
            warnings.push('FEFO_VIOLATION');
          }
        }

        let remaining = Number(line.quantityBase) - overrideTotal;
        if (remaining > 0) {
          const ordered = this.sortFefoCandidatesWithContainerPreference(allStocks, remainMap, remaining);
          for (const stock of ordered) {
            if (remaining <= 0) break;
            const key = this.stockKey(stock);
            const avail = remainMap.get(key) ?? 0;
            if (avail <= 0) continue;
            const alloc = Math.min(avail, remaining);
            if (alloc <= 0) continue;
            tasks.push({
              issueLineId: line.id,
              productId: line.productId,
              batchId: stock.batchId,
              locationId: stock.locationId,
              containerId: stock.containerId,
              quantityBase: alloc,
              pickedQuantity: 0,
              status: 'pending',
            });
            remainMap.set(key, avail - alloc);
            remaining -= alloc;
          }
        }

        if (remaining > 0) {
          throw new ConflictException('Không đủ tồn để allocate pick tasks');
        }
      }

      if (tasks.length === 0) {
        throw new BadRequestException('Không có pick task nào được allocate');
      }

      await tx.pickTask.createMany({ data: tasks });
      const updatedIssue = await tx.issue.update({
        where: { id: issue.id },
        data: { status: 'planned' },
      });
      const createdTasks = await tx.pickTask.findMany({
        where: { issueLine: { issueId: issue.id } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        issueBefore: issue,
        issueAfter: updatedIssue,
        tasks: createdTasks,
        warnings: [...new Set(warnings)],
      };
    });

    await this.auditService.logEvent({
      action: 'PLAN_PICK',
      entity_type: 'issues',
      entity_id: issueId,
      before: response.issueBefore as unknown as Prisma.InputJsonValue,
      after: {
        issue: response.issueAfter,
        warnings: response.warnings,
      } as unknown as Prisma.InputJsonValue,
      reason: 'Plan FEFO pick tasks',
    });

    return {
      issue: response.issueAfter,
      tasks: response.tasks,
      warnings: response.warnings,
    };
  }

  async softReserveIssue(actorUserId: string, issueId: string) {
    this.contextService.setActorUserId(actorUserId);

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Issue không tồn tại');
    if (issue.status !== 'planned') throw new ConflictException('Issue phải ở trạng thái planned');

    const tasks = await this.prisma.pickTask.findMany({
      where: { issueLine: { issueId } },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) throw new BadRequestException('Issue chưa có pick tasks');

    const { softReserveMinutes } = await this.appTimeoutConfigService.getTimeouts();
    const reserved: Array<{ taskId: string; reservationId: string }> = [];
    try {
      for (const task of tasks) {
        if (task.reservationId) continue;
        const reservation = await this.reservationService.softReserve(actorUserId, {
          productId: task.productId,
          batchId: task.batchId,
          locationId: task.locationId,
          containerId: task.containerId ?? undefined,
          quantityBase: Number(task.quantityBase),
          ttlSeconds: softReserveMinutes * 60,
        });
        await this.prisma.pickTask.update({
          where: { id: task.id },
          data: { reservationId: reservation.id },
        });
        reserved.push({ taskId: task.id, reservationId: reservation.id });
      }
    } catch (error) {
      for (const x of reserved) {
        await this.prisma.pickTask.update({
          where: { id: x.taskId },
          data: { reservationId: null },
        });
        try {
          await this.reservationService.release(actorUserId, x.reservationId);
        } catch {
          // ignore rollback release failure and keep original root error
        }
      }
      throw error;
    }

    const after = await this.prisma.issue.findUnique({ where: { id: issueId } });
    await this.auditService.logEvent({
      action: 'SOFT_RESERVE_ISSUE',
      entity_type: 'issues',
      entity_id: issueId,
      before: issue as unknown as Prisma.InputJsonValue,
      after: {
        issue: after,
        reservedCount: reserved.length,
      } as unknown as Prisma.InputJsonValue,
      reason: 'Soft reserve all pick tasks of issue',
    });

    return {
      issue: after,
      reservedCount: reserved.length,
    };
  }

  async startPicking(actorUserId: string, issueId: string) {
    this.contextService.setActorUserId(actorUserId);

    const before = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!before) throw new NotFoundException('Issue không tồn tại');
    if (before.status !== 'planned') throw new ConflictException('Issue phải ở trạng thái planned');

    const tasks = await this.prisma.pickTask.findMany({
      where: { issueLine: { issueId } },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) throw new BadRequestException('Issue chưa có pick tasks');
    if (tasks.some((x) => !x.reservationId)) {
      throw new ConflictException('Issue còn pick_task chưa soft reserve');
    }

    for (const task of tasks) {
      await this.reservationService.hardLock(actorUserId, task.reservationId!);
    }

    const after = await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'picking' },
    });
    await this.auditService.logEvent({
      action: 'START_PICKING',
      entity_type: 'issues',
      entity_id: issueId,
      before: before as unknown as Prisma.InputJsonValue,
      after: after as unknown as Prisma.InputJsonValue,
      reason: 'Start picking issue',
    });

    return after;
  }

  async completeIssue(actorUserId: string, issueId: string) {
    this.contextService.setActorUserId(actorUserId);

    const before = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!before) throw new NotFoundException('Issue không tồn tại');
    if (before.status !== 'picking') {
      throw new ConflictException('Issue phải ở trạng thái picking');
    }

    const tasks = await this.prisma.pickTask.findMany({
      where: { issueLine: { issueId } },
      include: { reservation: true },
    });
    if (tasks.length === 0) throw new BadRequestException('Issue không có pick task');
    if (tasks.some((t) => t.status !== 'done')) {
      throw new ConflictException('Không thể complete khi còn pick_task chưa done');
    }

    const response = await this.issueRepository.withTransaction(async (tx) => {
      for (const task of tasks) {
        if (!task.reservationId || !task.reservation) {
          throw new ConflictException('Pick task chưa có reservation');
        }
        await tx.$queryRaw`
          SELECT id FROM reservations WHERE id = ${task.reservationId}::uuid FOR UPDATE
        `;
        const reservation = await tx.reservation.findUnique({
          where: { id: task.reservationId },
        });
        if (!reservation || reservation.status !== 'hard_locked') {
          throw new ConflictException('Reservation phải ở trạng thái hard_locked để complete');
        }

        await tx.$queryRaw`
          SELECT id
          FROM stock_lines
          WHERE product_id = ${task.productId}::uuid
            AND batch_id = ${task.batchId}::uuid
            AND location_id = ${task.locationId}::uuid
            AND container_id IS NOT DISTINCT FROM ${task.containerId ?? null}::uuid
          FOR UPDATE
        `;
        const stock = await tx.stockLine.findFirst({
          where: {
            productId: task.productId,
            batchId: task.batchId,
            locationId: task.locationId,
            containerId: task.containerId ?? null,
          },
        });
        if (!stock) throw new ConflictException('Không tồn tại stock line cho pick task');
        if (new Prisma.Decimal(stock.quantityBase).lt(task.pickedQuantity)) {
          throw new ConflictException('Không đủ tồn để complete issue');
        }

        await tx.stockLine.update({
          where: { id: stock.id },
          data: {
            quantityBase: new Prisma.Decimal(stock.quantityBase).minus(task.pickedQuantity),
          },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'released' },
        });
      }

      const updated = await tx.issue.update({
        where: { id: issueId },
        data: { status: 'completed' },
      });
      return updated;
    });

    await this.auditService.logEvent({
      action: 'COMPLETE_ISSUE',
      entity_type: 'issues',
      entity_id: issueId,
      before: before as unknown as Prisma.InputJsonValue,
      after: response as unknown as Prisma.InputJsonValue,
      reason: 'Complete issue and deduct stock',
    });

    return response;
  }

  async cancelIssue(actorUserId: string, issueId: string) {
    this.contextService.setActorUserId(actorUserId);

    const before = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!before) throw new NotFoundException('Issue không tồn tại');
    if (before.status === 'completed' || before.status === 'cancelled') {
      throw new ConflictException('Issue đã completed/cancelled');
    }

    const tasks = await this.prisma.pickTask.findMany({
      where: { issueLine: { issueId } },
    });
    for (const task of tasks) {
      if (task.reservationId) {
        try {
          await this.reservationService.release(actorUserId, task.reservationId);
        } catch {
          // ignore released/invalid transitions, continue cancel flow
        }
      }
    }

    const after = await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'cancelled' },
    });

    await this.auditService.logEvent({
      action: 'CANCEL_ISSUE',
      entity_type: 'issues',
      entity_id: issueId,
      before: before as unknown as Prisma.InputJsonValue,
      after: after as unknown as Prisma.InputJsonValue,
      reason: 'Cancel issue',
    });
    return after;
  }

  private async getStockCandidates(tx: Tx, productId: string): Promise<StockCandidate[]> {
    return tx.stockLine.findMany({
      where: {
        productId,
        quantityBase: { gt: 0 },
      },
      include: {
        batch: {
          select: {
            expiryDate: true,
          },
        },
      },
      orderBy: [{ batch: { expiryDate: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  private stockKey(stock: { productId: string; batchId: string; locationId: string; containerId: string | null }) {
    return `${stock.productId}:${stock.batchId}:${stock.locationId}:${stock.containerId ?? 'null'}`;
  }

  private sortFefoCandidatesWithContainerPreference(
    stocks: StockCandidate[],
    remainMap: Map<string, number>,
    remaining: number,
  ) {
    return [...stocks].sort((a, b) => {
      const expCmp = a.batch.expiryDate.getTime() - b.batch.expiryDate.getTime();
      if (expCmp !== 0) return expCmp;

      const aAvail = remainMap.get(this.stockKey(a)) ?? 0;
      const bAvail = remainMap.get(this.stockKey(b)) ?? 0;
      const aFullContainerHit = a.containerId && remaining >= aAvail ? 0 : 1;
      const bFullContainerHit = b.containerId && remaining >= bAvail ? 0 : 1;
      if (aFullContainerHit !== bFullContainerHit) return aFullContainerHit - bFullContainerHit;
      return bAvail - aAvail;
    });
  }
}
