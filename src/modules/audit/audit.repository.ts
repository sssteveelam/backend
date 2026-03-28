import { Injectable } from '@nestjs/common';
import { AuditEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditListQueryDto } from './dto/audit-list-query.dto';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(data: {
    actorUserId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    beforeJson?: Prisma.InputJsonValue | null;
    afterJson?: Prisma.InputJsonValue | null;
    reason?: string;
    correlationId: string;
  }): Promise<void> {
    const beforeJson =
      data.beforeJson === null ? Prisma.JsonNull : data.beforeJson;
    const afterJson = data.afterJson === null ? Prisma.JsonNull : data.afterJson;

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        beforeJson,
        afterJson,
        reason: data.reason,
        correlationId: data.correlationId,
      },
    });
  }

  async listAuditEvents(
    query: AuditListQueryDto,
    skip: number,
    take: number,
  ): Promise<{ rows: AuditEvent[]; total: number }> {
    const where: Prisma.AuditEventWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : null),
      ...(query.entityId ? { entityId: query.entityId } : null),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : null),
      ...(query.action ? { action: query.action } : null),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : null),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : null),
            },
          }
        : null),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { rows, total };
  }
}
