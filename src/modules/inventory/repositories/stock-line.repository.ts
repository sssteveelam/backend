import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StockLineRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInventory(input: {
    productId?: string;
    locationId?: string;
  }) {
    return this.prisma.stockLine.findMany({
      where: {
        productId: input.productId,
        locationId: input.locationId,
      },
      include: {
        product: true,
        batch: {
          include: {
            supplier: true,
          },
        },
        location: true,
        container: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  findNearExpiry(days: number) {
    const now = new Date();
    const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.prisma.stockLine.findMany({
      where: {
        batch: {
          expiryDate: {
            lte: target,
          },
        },
      },
      include: {
        product: true,
        batch: {
          include: {
            supplier: true,
          },
        },
        location: true,
        container: true,
      },
      orderBy: {
        batch: {
          expiryDate: 'asc',
        },
      },
    });
  }

  findByLocationCode(locationCode: string) {
    return this.prisma.stockLine.findMany({
      where: {
        location: {
          code: locationCode,
        },
      },
      include: {
        product: true,
        batch: {
          include: {
            supplier: true,
          },
        },
        location: true,
        container: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findSuggestions(input: {
    productId: string;
    warehouseId?: string;
    locationId?: string;
    limit?: number;
  }) {
    return this.prisma.stockLine.findMany({
      where: {
        productId: input.productId,
        locationId: input.locationId,
        location: input.warehouseId
          ? {
              warehouseId: input.warehouseId,
            }
          : undefined,
        quantityBase: {
          gt: 0,
        },
      },
      include: {
        product: true,
        batch: {
          include: {
            supplier: true,
          },
        },
        location: true,
        container: true,
      },
      orderBy: [
        {
          batch: {
            expiryDate: 'asc',
          },
        },
        {
          quantityBase: 'desc',
        },
      ],
      take: input.limit || 10,
    });
  }
}
