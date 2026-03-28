import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContext } from './context.types';

@Injectable()
export class ContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run(context: RequestContext, callback: () => void): void {
    this.storage.run(context, callback);
  }

  get(): RequestContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      const fallback: RequestContext = {
        correlationId: `system-${randomUUID()}`,
        actorUserId: null,
      };
      this.storage.enterWith(fallback);
      return fallback;
    }

    return ctx;
  }

  setActorUserId(actorUserId: string): void {
    const ctx = this.get();
    ctx.actorUserId = actorUserId;
  }
}
