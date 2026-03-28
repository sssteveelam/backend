import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertIdempotencyKey(params: {
    actorUserId: string;
    route: string;
    key: string;
    requestHash: string;
  }): Promise<void> {
    await this.prisma.idempotencyKey.create({
      data: {
        actorUserId: params.actorUserId,
        route: params.route,
        key: params.key,
        requestHash: params.requestHash,
      },
    });
  }
}
