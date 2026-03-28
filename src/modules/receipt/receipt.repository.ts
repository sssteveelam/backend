import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, Receipt, ReceiptLine } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptListQueryDto } from './dto/receipt-list-query.dto';

@Injectable()
export class ReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  createReceipt(data: Prisma.ReceiptCreateInput): Promise<Receipt> {
    return this.prisma.receipt.create({ data });
  }

  findReceiptById(id: string): Promise<Receipt | null> {
    return this.prisma.receipt.findUnique({ where: { id } });
  }

  findReceiptByCode(code: string): Promise<Receipt | null> {
    return this.prisma.receipt.findUnique({ where: { code } });
  }

  createReceiptLine(data: Prisma.ReceiptLineCreateInput): Promise<ReceiptLine> {
    return this.prisma.receiptLine.create({ data });
  }

  findReceiptLines(receiptId: string): Promise<ReceiptLine[]> {
    return this.prisma.receiptLine.findMany({
      where: { receiptId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findReceiptWithLinesById(id: string) {
    return this.prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async listReceipts(query: ReceiptListQueryDto, skip: number, take: number) {
    const where: Prisma.ReceiptWhereInput = {
      ...(query.status ? { status: query.status } : null),
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
      ...(query.supplierId ? { supplierId: query.supplierId } : null),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : null),
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
      this.prisma.receipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return { rows, total };
  }

  async withTransaction<T>(
    callback: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx));
  }
}
