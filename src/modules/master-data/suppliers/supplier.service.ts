import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierRepository } from './supplier.repository';

@Injectable()
export class SupplierService {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async create(actorUserId: string, dto: CreateSupplierDto): Promise<Supplier> {
    this.contextService.setActorUserId(actorUserId);

    const existed = await this.supplierRepository.findByCode(dto.code);
    if (existed) {
      throw new ConflictException('Supplier code đã tồn tại');
    }

    const created = await this.supplierRepository.create({
      code: dto.code,
      name: dto.name,
    });

    await this.auditService.logEvent({
      action: 'CREATE_SUPPLIER',
      entity_type: 'suppliers',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create supplier',
    });

    return created;
  }

  async findAll(actorUserId: string): Promise<Supplier[]> {
    this.contextService.setActorUserId(actorUserId);

    const suppliers = await this.supplierRepository.findMany();
    await this.auditService.logEvent({
      action: 'VIEW_SUPPLIERS',
      entity_type: 'suppliers',
      entity_id: undefined,
      before: null,
      after: { count: suppliers.length },
      reason: 'List suppliers',
    });

    return suppliers;
  }

  async findById(actorUserId: string, id: string): Promise<Supplier> {
    this.contextService.setActorUserId(actorUserId);

    const supplier = await this.supplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundException('Supplier không tồn tại');
    }

    await this.auditService.logEvent({
      action: 'VIEW_SUPPLIER',
      entity_type: 'suppliers',
      entity_id: supplier.id,
      before: null,
      after: supplier,
      reason: 'View supplier',
    });

    return supplier;
  }

  async update(actorUserId: string, id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.supplierRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Supplier không tồn tại');
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExisted = await this.supplierRepository.findByCode(dto.code);
      if (codeExisted) {
        throw new ConflictException('Supplier code đã tồn tại');
      }
    }

    const updated = await this.supplierRepository.update(id, {
      code: dto.code,
      name: dto.name,
    });

    await this.auditService.logEvent({
      action: 'UPDATE_SUPPLIER',
      entity_type: 'suppliers',
      entity_id: updated.id,
      before: existing,
      after: updated,
      reason: 'Update supplier',
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<{ ok: true }> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.supplierRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Supplier không tồn tại');
    }

    await this.supplierRepository.delete(id);

    await this.auditService.logEvent({
      action: 'DELETE_SUPPLIER',
      entity_type: 'suppliers',
      entity_id: existing.id,
      before: existing,
      after: null,
      reason: 'Delete supplier',
    });

    return { ok: true };
  }
}
