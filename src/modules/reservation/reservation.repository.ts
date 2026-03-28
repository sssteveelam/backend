import { Injectable } from '@nestjs/common';
import { Prisma, Reservation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  withTransaction<T>(
    callback: (
      tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx));
  }

  create(data: Prisma.ReservationCreateInput): Promise<Reservation> {
    return this.prisma.reservation.create({ data });
  }

  findById(id: string): Promise<Reservation | null> {
    return this.prisma.reservation.findUnique({ where: { id } });
  }
}
