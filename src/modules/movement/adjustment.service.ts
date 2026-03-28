import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type ApplyAdjustmentInput = {
  productId: string;
  batchId: string;
  locationId: string;
  containerId?: string;
  newQuantityBase: number;
  reason: string;
  action: string;
  extraAfter?: Record<string, unknown>;
};

@Injectable()
export class AdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async applyWithTransaction(tx: Prisma.TransactionClient, input: ApplyAdjustmentInput) {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    const batch = await tx.batch.findUnique({ where: { id: input.batchId } });
    const location = await tx.location.findUnique({ where: { id: input.locationId } });
    if (!product || !batch || !location) {
      throw new NotFoundException('product/batch/location không tồn tại');
    }

    if (input.containerId) {
      const container = await tx.container.findUnique({ where: { id: input.containerId } });
      if (!container) throw new NotFoundException('Container không tồn tại');
    }

    if (input.newQuantityBase < 0) {
      throw new BadRequestException('Không cho phép âm tồn');
    }

    const stock = await tx.stockLine.findFirst({
      where: {
        productId: input.productId,
        batchId: input.batchId,
        locationId: input.locationId,
        containerId: input.containerId ?? null,
      },
    });

    const before = stock;
    const current = Number(stock?.quantityBase ?? 0);
    const diff = input.newQuantityBase - current;

    let after;
    if (stock) {
      after = await tx.stockLine.update({
        where: { id: stock.id },
        data: { quantityBase: input.newQuantityBase },
      });
    } else {
      after = await tx.stockLine.create({
        data: {
          productId: input.productId,
          batchId: input.batchId,
          locationId: input.locationId,
          containerId: input.containerId ?? null,
          quantityBase: input.newQuantityBase,
        },
      });
    }

    await this.auditService.logEvent({
      action: input.action,
      entity_type: 'stock_lines',
      entity_id: after.id,
      before,
      after: {
        ...after,
        diff,
        ...(input.extraAfter ?? {}),
      } as unknown as Prisma.InputJsonValue,
      reason: input.reason,
    });

    return { before, after, diff };
  }

  async apply(input: ApplyAdjustmentInput) {
    return this.prisma.$transaction((tx) => this.applyWithTransaction(tx, input));
  }
}
