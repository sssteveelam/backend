import { Injectable } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.LocationCreateInput): Promise<Location> {
    return this.prisma.location.create({ data });
  }

  findByWarehouseId(warehouseId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' },
    });
  }

  findByWarehouseAndCode(warehouseId: string, code: string): Promise<Location | null> {
    return this.prisma.location.findUnique({
      where: {
        warehouseId_code: {
          warehouseId,
          code,
        },
      },
    });
  }

  findByCode(code: string): Promise<Location | null> {
    return this.prisma.location.findFirst({
      where: { code },
      orderBy: { id: 'asc' },
    });
  }
}
