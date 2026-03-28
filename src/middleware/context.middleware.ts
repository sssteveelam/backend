import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ContextService } from '../modules/context/context.service';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: ContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const correlationIdHeader = req.header('x-correlation-id');
    const correlationId = correlationIdHeader?.trim() || randomUUID();

    this.contextService.run(
      {
        correlationId,
        actorUserId: null,
      },
      () => {
        next();
      },
    );
  }
}
