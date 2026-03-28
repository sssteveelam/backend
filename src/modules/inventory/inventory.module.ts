import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BatchRepository } from './repositories/batch.repository';
import { ContainerRepository } from './repositories/container.repository';
import { StockLineRepository } from './repositories/stock-line.repository';
import { BatchService } from './services/batch.service';
import { InventoryQueryService } from './services/inventory-query.service';
import { BatchController } from './controllers/batch.controller';
import { InventoryController } from './controllers/inventory.controller';
import { ContainerController } from './controllers/container.controller';
import { LocationInventoryController } from './controllers/location-inventory.controller';
import { MasterDataModule } from '../master-data/master-data.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalModule } from '../approval/approval.module';
import { ContainerSealService } from './services/container-seal.service';

@Module({
  imports: [AuditModule, MasterDataModule, PrismaModule, ApprovalModule],
  controllers: [
    BatchController,
    InventoryController,
    ContainerController,
    LocationInventoryController,
  ],
  providers: [
    BatchRepository,
    ContainerRepository,
    StockLineRepository,
    BatchService,
    InventoryQueryService,
    ContainerSealService,
  ],
  exports: [BatchService, InventoryQueryService],
})
export class InventoryModule {}
