import { Injectable } from '@nestjs/common';
import { Batch, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findComposite(input: {
    productId: string;
    supplierId: string | null;
    manufactureDate: Date;
    expiryDate: Date;
    lotCode: string;
  }): Promise<Batch | null> {
    return this.prisma.batch.findFirst({
      where: {
        productId: input.productId,
        supplierId: input.supplierId,
        manufactureDate: input.manufactureDate,
        expiryDate: input.expiryDate,
        lotCode: input.lotCode,
      },
    });
  }

  create(data: Prisma.BatchCreateInput): Promise<Batch> {
    return this.prisma.batch.create({ data });
  }

  findMany(input: {
    productId?: string;
    nearExpiryDays?: number;
  }): Promise<Batch[]> {
    const now = new Date();
    const nearExpiryDate =
      input.nearExpiryDays !== undefined
        ? new Date(now.getTime() + input.nearExpiryDays * 24 * 60 * 60 * 1000)
        : undefined;

    return this.prisma.batch.findMany({
      where: {
        productId: input.productId,
        expiryDate:
          nearExpiryDate !== undefined
            ? {
                lte: nearExpiryDate,
              }
            : undefined,
      },
      include: {
        product: true,
        supplier: true,
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
    });
  }
}
