import { Injectable } from '@nestjs/common';
import { CycleCount, CycleCountLine, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CycleCountListQueryDto } from './dto/cycle-count-list-query.dto';

@Injectable()
export class CycleCountRepository {
  constructor(private readonly prisma: PrismaService) {}

  createCycleCount(data: Prisma.CycleCountCreateInput): Promise<CycleCount> {
    return this.prisma.cycleCount.create({ data });
  }

  findById(id: string): Promise<CycleCount | null> {
    return this.prisma.cycleCount.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<CycleCount | null> {
    return this.prisma.cycleCount.findUnique({ where: { code } });
  }

  createLine(data: Prisma.CycleCountLineCreateInput): Promise<CycleCountLine> {
    return this.prisma.cycleCountLine.create({ data });
  }

  findLines(cycleCountId: string): Promise<CycleCountLine[]> {
    return this.prisma.cycleCountLine.findMany({
      where: { cycleCountId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listCycleCounts(query: CycleCountListQueryDto, skip: number, take: number) {
    const where: Prisma.CycleCountWhereInput = {
      ...(query.status ? { status: query.status } : null),
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
      ...(query.locationId ? { locationId: query.locationId } : null),
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
      this.prisma.cycleCount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.cycleCount.count({ where }),
    ]);

    return { rows, total };
  }

  findCycleCountWithLinesById(id: string) {
    return this.prisma.cycleCount.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  withTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => callback(tx));
  }
}
