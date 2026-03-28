import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { InventoryModule } from '../inventory/inventory.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ApprovalModule } from '../approval/approval.module';
import { CapacityModule } from '../capacity/capacity.module';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { ReceiptRepository } from './receipt.repository';

@Module({
  imports: [AuditModule, MasterDataModule, InventoryModule, IdempotencyModule, ApprovalModule, CapacityModule],
  controllers: [ReceiptController],
  providers: [ReceiptService, ReceiptRepository],
})
export class ReceiptModule {}
