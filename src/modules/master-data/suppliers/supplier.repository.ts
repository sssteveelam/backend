import { Injectable } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  findMany(): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({ orderBy: { code: 'asc' } });
  }

  findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { code } });
  }

  update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  delete(id: string): Promise<Supplier> {
    return this.prisma.supplier.delete({ where: { id } });
  }
}
