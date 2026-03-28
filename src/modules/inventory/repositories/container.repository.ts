import { Injectable } from '@nestjs/common';
import { Container } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByQrCode(qrCode: string): Promise<Container | null> {
    return this.prisma.container.findUnique({ where: { qrCode } });
  }

  findByQrCodeWithStockLines(qrCode: string) {
    return this.prisma.container.findUnique({
      where: { qrCode },
      include: {
        location: true,
        stockLines: {
          include: {
            product: true,
            batch: true,
            location: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
}
