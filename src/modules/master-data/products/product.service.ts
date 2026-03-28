import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async create(actorUserId: string, dto: CreateProductDto): Promise<Product> {
    this.contextService.setActorUserId(actorUserId);

    const existed = await this.productRepository.findByCode(dto.code);
    if (existed) {
      throw new ConflictException('Product code đã tồn tại');
    }

    const created = await this.productRepository.create({
      code: dto.code,
      name: dto.name,
      baseUom: dto.baseUom,
    });

    await this.auditService.logEvent({
      action: 'CREATE_PRODUCT',
      entity_type: 'products',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create product',
    });

    return created;
  }

  async findAll(actorUserId: string): Promise<Product[]> {
    this.contextService.setActorUserId(actorUserId);

    const products = await this.productRepository.findMany();
    await this.auditService.logEvent({
      action: 'VIEW_PRODUCTS',
      entity_type: 'products',
      entity_id: undefined,
      before: null,
      after: { count: products.length },
      reason: 'List products',
    });

    return products;
  }

  async findById(actorUserId: string, id: string): Promise<Product> {
    this.contextService.setActorUserId(actorUserId);

    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException('Product không tồn tại');
    }

    await this.auditService.logEvent({
      action: 'VIEW_PRODUCT',
      entity_type: 'products',
      entity_id: product.id,
      before: null,
      after: product,
      reason: 'View product',
    });

    return product;
  }

  async update(actorUserId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Product không tồn tại');
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExisted = await this.productRepository.findByCode(dto.code);
      if (codeExisted) {
        throw new ConflictException('Product code đã tồn tại');
      }
    }

    const updated = await this.productRepository.update(id, {
      code: dto.code,
      name: dto.name,
      baseUom: dto.baseUom,
    });

    await this.auditService.logEvent({
      action: 'UPDATE_PRODUCT',
      entity_type: 'products',
      entity_id: updated.id,
      before: existing,
      after: updated,
      reason: 'Update product',
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<{ ok: true }> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Product không tồn tại');
    }

    await this.productRepository.delete(id);

    await this.auditService.logEvent({
      action: 'DELETE_PRODUCT',
      entity_type: 'products',
      entity_id: existing.id,
      before: existing,
      after: null,
      reason: 'Delete product',
    });

    return { ok: true };
  }
}
