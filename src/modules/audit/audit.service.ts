import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContextService } from '../context/context.service';
import { AuditRepository } from './audit.repository';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { AuditLogItemDto } from './dto/audit-log-item.dto';
import { buildListResponse, ListResponse } from '../../common/dto/list-response.dto';
import { getPaginationSkipTake } from '../../common/dto/pagination-query.dto';

@Injectable()
export class AuditService {
  constructor(
    private readonly contextService: ContextService,
    private readonly auditRepository: AuditRepository,
  ) {}

  async logEvent(input: {
    action: 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_VIEW_ME' | string;
    entity_type?: string;
    entity_id?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string;
  }): Promise<void> {
    const context = this.contextService.get();

    if (!context.actorUserId) {
      throw new Error('AUDIT_ACTOR_USER_ID_REQUIRED');
    }

    if (!context.correlationId) {
      throw new Error('AUDIT_CORRELATION_ID_REQUIRED');
    }

    await this.auditRepository.createEvent({
      actorUserId: context.actorUserId,
      action: input.action,
      entityType: input.entity_type,
      entityId: input.entity_id,
      beforeJson: input.before,
      afterJson: input.after,
      reason: input.reason,
      correlationId: context.correlationId,
    });
  }

  /**
   * Worker / background jobs: explicit actor + correlation (no HTTP context required).
   */
  async logSystemEvent(input: {
    actorUserId: string;
    correlationId: string;
    action: string;
    entity_type?: string;
    entity_id?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string;
  }): Promise<void> {
    await this.auditRepository.createEvent({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entity_type,
      entityId: input.entity_id,
      beforeJson: input.before,
      afterJson: input.after,
      reason: input.reason,
      correlationId: input.correlationId,
    });
  }

  // PROPOSED NEW API: GET /audit (admin read)
  async listAuditEvents(query: AuditListQueryDto): Promise<ListResponse<AuditLogItemDto>> {
    if (query.createdFrom && query.createdTo) {
      const from = new Date(query.createdFrom);
      const to = new Date(query.createdTo);
      if (from > to) {
        throw new BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
      }
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.auditRepository.listAuditEvents(query, skip, take);

    return buildListResponse({
      data: rows.map((row) => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        actorUserId: row.actorUserId,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
        // Prisma JSON-null may come back as the JsonNull sentinel; normalize to `null` for API.
        before: (row.beforeJson as unknown) === Prisma.JsonNull ? null : row.beforeJson ?? null,
        after: (row.afterJson as unknown) === Prisma.JsonNull ? null : row.afterJson ?? null,
      })),
      page: query.page,
      limit: query.limit,
      total,
    });
  }
}
