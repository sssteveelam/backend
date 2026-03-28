import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Warehouse } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseRepository } from './warehouse.repository';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly warehouseRepository: WarehouseRepository,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async create(actorUserId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    this.contextService.setActorUserId(actorUserId);

    const existedCode = await this.warehouseRepository.findByCode(dto.code);
    if (existedCode) {
      throw new ConflictException('Warehouse code đã tồn tại');
    }

    const created = await this.warehouseRepository.create({
      code: dto.code,
      name: dto.name,
    });

    await this.auditService.logEvent({
      action: 'CREATE_WAREHOUSE',
      entity_type: 'warehouses',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create warehouse',
    });

    return created;
  }

  async findAll(actorUserId: string): Promise<Warehouse[]> {
    this.contextService.setActorUserId(actorUserId);

    const warehouses = await this.warehouseRepository.findMany();
    await this.auditService.logEvent({
      action: 'VIEW_WAREHOUSES',
      entity_type: 'warehouses',
      entity_id: undefined,
      before: null,
      after: { count: warehouses.length },
      reason: 'List warehouses',
    });

    return warehouses;
  }

  async findById(actorUserId: string, id: string): Promise<Warehouse> {
    this.contextService.setActorUserId(actorUserId);

    const warehouse = await this.warehouseRepository.findById(id);
    if (!warehouse) {
      throw new NotFoundException('Warehouse không tồn tại');
    }

    await this.auditService.logEvent({
      action: 'VIEW_WAREHOUSE',
      entity_type: 'warehouses',
      entity_id: warehouse.id,
      before: null,
      after: warehouse,
      reason: 'View warehouse',
    });

    return warehouse;
  }

  async update(actorUserId: string, id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.warehouseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Warehouse không tồn tại');
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExisted = await this.warehouseRepository.findByCode(dto.code);
      if (codeExisted) {
        throw new ConflictException('Warehouse code đã tồn tại');
      }
    }

    const updated = await this.warehouseRepository.update(id, {
      code: dto.code,
      name: dto.name,
    });

    await this.auditService.logEvent({
      action: 'UPDATE_WAREHOUSE',
      entity_type: 'warehouses',
      entity_id: updated.id,
      before: existing,
      after: updated,
      reason: 'Update warehouse',
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<{ ok: true }> {
    this.contextService.setActorUserId(actorUserId);

    const existing = await this.warehouseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Warehouse không tồn tại');
    }

    await this.warehouseRepository.delete(id);

    await this.auditService.logEvent({
      action: 'DELETE_WAREHOUSE',
      entity_type: 'warehouses',
      entity_id: existing.id,
      before: existing,
      after: null,
      reason: 'Delete warehouse',
    });

    return { ok: true };
  }
}
