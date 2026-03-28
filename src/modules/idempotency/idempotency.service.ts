import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { IdempotencyRepository } from './idempotency.repository';

@Injectable()
export class IdempotencyService {
  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  hashRequestBody(requestBody: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(requestBody ?? {}))
      .digest('hex');
  }

  async saveKey(input: {
    actorUserId: string;
    route: string;
    key: string;
    requestBody: unknown;
  }): Promise<void> {
    const requestHash = this.hashRequestBody(input.requestBody);

    const existed = await this.idempotencyRepository.findOne({
      actorUserId: input.actorUserId,
      route: input.route,
      key: input.key,
    });

    if (existed) {
      if (existed.requestHash !== requestHash) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      }
      return;
    }

    await this.idempotencyRepository.create({
      actorUserId: input.actorUserId,
      route: input.route,
      key: input.key,
      requestHash,
    });
  }

  findOne(input: { actorUserId: string; route: string; key: string }) {
    return this.idempotencyRepository.findOne(input);
  }

  createWithResponse(input: {
    actorUserId: string;
    route: string;
    key: string;
    requestBody: unknown;
    responseJson: Prisma.InputJsonValue;
  }) {
    const requestHash = this.hashRequestBody(input.requestBody);
    return this.findOne({
      actorUserId: input.actorUserId,
      route: input.route,
      key: input.key,
    }).then((existing) => {
      if (!existing) {
        return this.idempotencyRepository.create({
          actorUserId: input.actorUserId,
          route: input.route,
          key: input.key,
          requestHash,
          responseJson: input.responseJson,
        });
      }

      return this.idempotencyRepository.updateResponse({
        id: existing.id,
        responseJson: input.responseJson,
      });
    });
  }
}
