import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ContextService } from '../../context/context.service';
import { LocationRepository } from '../../master-data/locations/location.repository';
import { ContainerRepository } from '../repositories/container.repository';
import { StockLineRepository } from '../repositories/stock-line.repository';
import { InventorySuggestionQueryDto, InventorySuggestionResponseDto } from '../dto/inventory-suggestion.dto';

@Injectable()
export class InventoryQueryService {
  constructor(
    private readonly stockLineRepository: StockLineRepository,
    private readonly containerRepository: ContainerRepository,
    private readonly locationRepository: LocationRepository,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
  ) {}

  async viewInventory(actorUserId: string, input: { productId?: string; locationId?: string }) {
    this.contextService.setActorUserId(actorUserId);

    const inventory = await this.stockLineRepository.findInventory(input);
    await this.auditService.logEvent({
      action: 'VIEW_INVENTORY',
      entity_type: 'stock_lines',
      before: null,
      after: { count: inventory.length, ...input },
      reason: 'View inventory',
    });

    return inventory;
  }

  /* ... other view methods ... */

  async getSuggestions(actorUserId: string, query: InventorySuggestionQueryDto): Promise<InventorySuggestionResponseDto> {
    this.contextService.setActorUserId(actorUserId);

    const lines = await this.stockLineRepository.findSuggestions({
      productId: query.productId,
      warehouseId: query.warehouseId,
      locationId: query.locationId,
      limit: query.limit,
    });

    const targetQty = query.quantityBase ? Number(query.quantityBase) : 0;
    const now = new Date();
    const nearExpiryCutoff = query.nearExpiryDays ? new Date(now.getTime() + query.nearExpiryDays * 24 * 60 * 60 * 1000) : null;

    const suggestions = lines.map((line, index) => {
      const expiry = line.batch.expiryDate;
      const qty = Number(line.quantityBase);
      
      let reasons: string[] = [];
      if (index === 0) reasons.push('FEFO earliest expiry');
      if (targetQty > 0 && qty >= targetQty) reasons.push('Sufficient quantity');
      if (nearExpiryCutoff && expiry <= nearExpiryCutoff) reasons.push('Near expiry priority');
      if (reasons.length === 0) reasons.push('Next available FEFO');

      return {
        rank: index + 1,
        locationId: line.locationId,
        locationCode: line.location.code,
        containerId: line.containerId,
        containerQrCode: line.container?.qrCode || null,
        batchId: line.batchId,
        batchLotCode: line.batch.lotCode,
        expiryDate: line.batch.expiryDate.toISOString(),
        availableQuantityBase: line.quantityBase.toString(),
        uomHint: line.product.baseUom,
        reason: reasons.join(', '),
      };
    });

    await this.auditService.logEvent({
      action: 'VIEW_SUGGESTIONS',
      entity_type: 'inventory',
      before: null,
      after: { productId: query.productId, count: suggestions.length },
      reason: 'Inventory recommendations requested (FEFO)',
    });

    return {
      productId: query.productId,
      basis: 'FEFO',
      suggestions,
    };
  }

  async viewNearExpiry(actorUserId: string, days: number) {
    this.contextService.setActorUserId(actorUserId);

    const inventory = await this.stockLineRepository.findNearExpiry(days);
    await this.auditService.logEvent({
      action: 'VIEW_INVENTORY',
      entity_type: 'stock_lines',
      before: null,
      after: { count: inventory.length, nearExpiryDays: days },
      reason: 'View near expiry inventory',
    });

    return inventory;
  }

  async viewContainerByQr(actorUserId: string, qrCode: string) {
    this.contextService.setActorUserId(actorUserId);

    const container = await this.containerRepository.findByQrCodeWithStockLines(qrCode);
    if (!container) {
      throw new NotFoundException('Container không tồn tại');
    }

    await this.auditService.logEvent({
      action: 'VIEW_CONTAINER',
      entity_type: 'containers',
      entity_id: container.id,
      before: null,
      after: {
        qrCode: container.qrCode,
        locationId: container.locationId,
        stockLineCount: container.stockLines.length,
      },
      reason: 'View container by qr',
    });

    return container;
  }

  async viewLocationByQr(actorUserId: string, qrCode: string) {
    this.contextService.setActorUserId(actorUserId);

    const location = await this.locationRepository.findByCode(qrCode);
    if (!location) {
      throw new NotFoundException('Location không tồn tại');
    }

    const inventory = await this.stockLineRepository.findInventory({ locationId: location.id });

    await this.auditService.logEvent({
      action: 'VIEW_LOCATION',
      entity_type: 'locations',
      entity_id: location.id,
      before: null,
      after: {
        locationCode: location.code,
        inventoryCount: inventory.length,
      },
      reason: 'View location inventory by qr',
    });

    return {
      location,
      inventory,
    };
  }
}
