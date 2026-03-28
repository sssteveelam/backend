import { Injectable } from '@nestjs/common';
import { IdempotencyKey, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    actorUserId: string;
    route: string;
    key: string;
    requestHash: string;
    responseJson?: Prisma.InputJsonValue;
  }): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.create({
      data: {
        actorUserId: input.actorUserId,
        route: input.route,
        key: input.key,
        requestHash: input.requestHash,
        responseJson: input.responseJson,
      },
    });
  }

  async updateResponse(input: {
    id: string;
    responseJson: Prisma.InputJsonValue;
  }): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.update({
      where: { id: input.id },
      data: { responseJson: input.responseJson },
    });
  }

  findOne(input: {
    actorUserId: string;
    route: string;
    key: string;
  }): Promise<IdempotencyKey | null> {
    return this.prisma.idempotencyKey.findFirst({
      where: {
        route: input.route,
        key: input.key,
        actorUserId: input.actorUserId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
