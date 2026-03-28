import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductUom } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { SupplierRepository } from '../suppliers/supplier.repository';
import { ProductRepository } from '../products/product.repository';
import { CreateProductUomDto } from './dto/create-product-uom.dto';
import { ProductUomRepository } from './product-uom.repository';

@Injectable()
export class ProductUomService {
  constructor(
    private readonly productUomRepository: ProductUomRepository,
    private readonly productRepository: ProductRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async findByProductId(actorUserId: string, productId: string): Promise<ProductUom[]> {
    this.contextService.setActorUserId(actorUserId);

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundException('Product không tồn tại');
    }

    const uoms = await this.productUomRepository.findByProductId(productId);
    await this.auditService.logEvent({
      action: 'VIEW_PRODUCT_UOMS',
      entity_type: 'product_uoms',
      entity_id: undefined,
      before: null,
      after: { productId, count: uoms.length },
      reason: 'List product uoms',
    });

    return uoms;
  }

  async create(
    actorUserId: string,
    productId: string,
    dto: CreateProductUomDto,
  ): Promise<ProductUom> {
    this.contextService.setActorUserId(actorUserId);

    if (dto.factorToBase <= 0) {
      throw new BadRequestException('factor_to_base phải > 0');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundException('Product không tồn tại');
    }

    if (dto.supplierId) {
      const supplier = await this.supplierRepository.findById(dto.supplierId);
      if (!supplier) {
        throw new NotFoundException('Supplier không tồn tại');
      }
    }

    const duplicated = await this.productUomRepository.findDuplicate({
      productId,
      supplierId: dto.supplierId ?? null,
      uom: dto.uom,
    });
    if (duplicated) {
      throw new ConflictException('Product UoM đã tồn tại với product/supplier/uom này');
    }

    const created = await this.productUomRepository.create({
      uom: dto.uom,
      factorToBase: dto.factorToBase,
      product: {
        connect: { id: productId },
      },
      supplier: dto.supplierId
        ? {
            connect: { id: dto.supplierId },
          }
        : undefined,
    });

    await this.auditService.logEvent({
      action: 'CREATE_PRODUCT_UOM',
      entity_type: 'product_uoms',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create product UoM',
    });

    return created;
  }

  async resolveConversion(params: {
    productId: string;
    supplierId: string | null;
    uom: string;
  }): Promise<ProductUom> {
    const direct = await this.productUomRepository.findForConversion({
      productId: params.productId,
      supplierId: params.supplierId,
      uom: params.uom,
    });

    if (direct) {
      return direct;
    }

    const fallback = await this.productUomRepository.findForConversion({
      productId: params.productId,
      supplierId: null,
      uom: params.uom,
    });

    if (fallback) {
      return fallback;
    }

    throw new NotFoundException('Không tìm thấy quy đổi UoM cho product/supplier');
  }
}
