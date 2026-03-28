import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ContextService } from '../modules/context/context.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly contextService: ContextService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.header('Idempotency-Key');

    if (!idempotencyKey) {
      next();
      return;
    }

    const context = this.contextService.get();
    const actorUserId = req.user?.id || context.actorUserId;

    if (!actorUserId) {
      next();
      return;
    }

    await this.idempotencyService.saveKey({
      actorUserId,
      route: req.path,
      key: idempotencyKey,
      requestBody: req.body,
    });

    next();
  }
}
