import { Injectable } from '@nestjs/common';
import { Prisma, Warehouse } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.WarehouseCreateInput): Promise<Warehouse> {
    return this.prisma.warehouse.create({ data });
  }

  findMany(): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string): Promise<Warehouse | null> {
    return this.prisma.warehouse.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<Warehouse | null> {
    return this.prisma.warehouse.findUnique({ where: { code } });
  }

  update(id: string, data: Prisma.WarehouseUpdateInput): Promise<Warehouse> {
    return this.prisma.warehouse.update({ where: { id }, data });
  }

  delete(id: string): Promise<Warehouse> {
    return this.prisma.warehouse.delete({ where: { id } });
  }
}
