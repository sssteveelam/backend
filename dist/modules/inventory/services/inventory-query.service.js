"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryQueryService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const location_repository_1 = require("../../master-data/locations/location.repository");
const container_repository_1 = require("../repositories/container.repository");
const stock_line_repository_1 = require("../repositories/stock-line.repository");
let InventoryQueryService = class InventoryQueryService {
    constructor(stockLineRepository, containerRepository, locationRepository, contextService, auditService) {
        this.stockLineRepository = stockLineRepository;
        this.containerRepository = containerRepository;
        this.locationRepository = locationRepository;
        this.contextService = contextService;
        this.auditService = auditService;
    }
    async viewInventory(actorUserId, input) {
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
    async getSuggestions(actorUserId, query) {
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
            let reasons = [];
            if (index === 0)
                reasons.push('FEFO earliest expiry');
            if (targetQty > 0 && qty >= targetQty)
                reasons.push('Sufficient quantity');
            if (nearExpiryCutoff && expiry <= nearExpiryCutoff)
                reasons.push('Near expiry priority');
            if (reasons.length === 0)
                reasons.push('Next available FEFO');
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
    async viewNearExpiry(actorUserId, days) {
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
    async viewContainerByQr(actorUserId, qrCode) {
        this.contextService.setActorUserId(actorUserId);
        const container = await this.containerRepository.findByQrCodeWithStockLines(qrCode);
        if (!container) {
            throw new common_1.NotFoundException('Container không tồn tại');
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
    async viewLocationByQr(actorUserId, qrCode) {
        this.contextService.setActorUserId(actorUserId);
        const location = await this.locationRepository.findByCode(qrCode);
        if (!location) {
            throw new common_1.NotFoundException('Location không tồn tại');
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
};
exports.InventoryQueryService = InventoryQueryService;
exports.InventoryQueryService = InventoryQueryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_line_repository_1.StockLineRepository,
        container_repository_1.ContainerRepository,
        location_repository_1.LocationRepository,
        context_service_1.ContextService,
        audit_service_1.AuditService])
], InventoryQueryService);
//# sourceMappingURL=inventory-query.service.js.map