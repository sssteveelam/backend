import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Batch } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { ProductRepository } from '../../master-data/products/product.repository';
import { SupplierRepository } from '../../master-data/suppliers/supplier.repository';
import { BatchRepository } from '../repositories/batch.repository';

@Injectable()
export class BatchService {
  constructor(
    private readonly batchRepository: BatchRepository,
    private readonly productRepository: ProductRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
  ) {}

  async getOrCreateBatchId(input: {
    actorUserId: string;
    productId: string;
    supplierId: string | null;
    manufactureDate: Date;
    expiryDate: Date;
    lotCode: string;
  }): Promise<string> {
    this.contextService.setActorUserId(input.actorUserId);

    if (input.expiryDate <= input.manufactureDate) {
      throw new BadRequestException('expiry_date phải lớn hơn manufacture_date');
    }

    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new NotFoundException('Product không tồn tại');
    }

    if (input.supplierId) {
      const supplier = await this.supplierRepository.findById(input.supplierId);
      if (!supplier) {
        throw new NotFoundException('Supplier không tồn tại');
      }
    }

    const existed = await this.batchRepository.findComposite({
      productId: input.productId,
      supplierId: input.supplierId,
      manufactureDate: input.manufactureDate,
      expiryDate: input.expiryDate,
      lotCode: input.lotCode,
    });

    if (existed) {
      return existed.id;
    }

    const created = await this.batchRepository.create({
      lotCode: input.lotCode,
      manufactureDate: input.manufactureDate,
      expiryDate: input.expiryDate,
      product: { connect: { id: input.productId } },
      supplier: input.supplierId ? { connect: { id: input.supplierId } } : undefined,
    });

    await this.auditService.logEvent({
      action: 'CREATE_BATCH',
      entity_type: 'batches',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create batch by identity',
    });

    return created.id;
  }

  async viewBatches(actorUserId: string, input: { productId?: string; nearExpiryDays?: number }) {
    this.contextService.setActorUserId(actorUserId);

    const batches = await this.batchRepository.findMany(input);
    await this.auditService.logEvent({
      action: 'VIEW_BATCHES',
      entity_type: 'batches',
      before: null,
      after: { count: batches.length },
      reason: 'View batches',
    });

    return batches;
  }
}
