import { Injectable } from '@nestjs/common';
import { Movement, MovementLine, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MovementListQueryDto } from './dto/movement-list-query.dto';

@Injectable()
export class MovementRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMovement(data: Prisma.MovementCreateInput): Promise<Movement> {
    return this.prisma.movement.create({ data });
  }

  findMovementById(id: string): Promise<Movement | null> {
    return this.prisma.movement.findUnique({ where: { id } });
  }

  findMovementByCode(code: string): Promise<Movement | null> {
    return this.prisma.movement.findUnique({ where: { code } });
  }

  createMovementLine(data: Prisma.MovementLineCreateInput): Promise<MovementLine> {
    return this.prisma.movementLine.create({ data });
  }

  findMovementLines(movementId: string): Promise<MovementLine[]> {
    return this.prisma.movementLine.findMany({
      where: { movementId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findMovementWithLinesById(id: string) {
    return this.prisma.movement.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async listMovements(query: MovementListQueryDto, skip: number, take: number) {
    const where: Prisma.MovementWhereInput = {
      ...(query.status ? { status: query.status } : null),
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
      ...(query.fromLocationId ? { fromLocationId: query.fromLocationId } : null),
      ...(query.toLocationId ? { toLocationId: query.toLocationId } : null),
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
      this.prisma.movement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return { rows, total };
  }

  withTransaction<T>(
    callback: (tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx));
  }
}
