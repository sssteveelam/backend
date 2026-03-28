import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { WarehouseRepository } from '../warehouses/warehouse.repository';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationRepository } from './location.repository';

@Injectable()
export class LocationService {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async create(actorUserId: string, dto: CreateLocationDto): Promise<Location> {
    this.contextService.setActorUserId(actorUserId);

    const warehouse = await this.warehouseRepository.findById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundException('Warehouse không tồn tại');
    }

    const duplicated = await this.locationRepository.findByWarehouseAndCode(
      dto.warehouseId,
      dto.code,
    );
    if (duplicated) {
      throw new ConflictException('Location code đã tồn tại trong warehouse');
    }

    const created = await this.locationRepository.create({
      code: dto.code,
      name: dto.name,
      capacityLimitBase: dto.capacityLimitBase,
      warehouse: {
        connect: { id: dto.warehouseId },
      },
    });

    await this.auditService.logEvent({
      action: 'CREATE_LOCATION',
      entity_type: 'locations',
      entity_id: created.id,
      before: null,
      after: created,
      reason: 'Create location',
    });

    return created;
  }

  async findByWarehouseId(actorUserId: string, warehouseId: string): Promise<Location[]> {
    this.contextService.setActorUserId(actorUserId);

    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new NotFoundException('Warehouse không tồn tại');
    }

    const locations = await this.locationRepository.findByWarehouseId(warehouseId);
    await this.auditService.logEvent({
      action: 'VIEW_LOCATIONS',
      entity_type: 'locations',
      entity_id: undefined,
      before: null,
      after: { warehouseId, count: locations.length },
      reason: 'List locations by warehouse',
    });

    return locations;
  }
}
