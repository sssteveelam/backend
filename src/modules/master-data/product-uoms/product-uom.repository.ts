import { Injectable } from '@nestjs/common';
import { Prisma, ProductUom } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductUomRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProductId(productId: string): Promise<ProductUom[]> {
    return this.prisma.productUom.findMany({
      where: { productId },
      orderBy: [{ supplierId: 'asc' }, { uom: 'asc' }],
    });
  }

  create(data: Prisma.ProductUomCreateInput): Promise<ProductUom> {
    return this.prisma.productUom.create({ data });
  }

  findDuplicate(params: {
    productId: string;
    supplierId: string | null;
    uom: string;
  }): Promise<ProductUom | null> {
    return this.prisma.productUom.findFirst({
      where: {
        productId: params.productId,
        supplierId: params.supplierId,
        uom: params.uom,
      },
    });
  }

  findForConversion(params: {
    productId: string;
    supplierId: string | null;
    uom: string;
  }): Promise<ProductUom | null> {
    return this.prisma.productUom.findFirst({
      where: {
        productId: params.productId,
        supplierId: params.supplierId,
        uom: params.uom,
      },
    });
  }
}
