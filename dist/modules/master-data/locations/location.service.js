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
exports.LocationService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const warehouse_repository_1 = require("../warehouses/warehouse.repository");
const location_repository_1 = require("./location.repository");
let LocationService = class LocationService {
    constructor(locationRepository, warehouseRepository, auditService, contextService) {
        this.locationRepository = locationRepository;
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async create(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const warehouse = await this.warehouseRepository.findById(dto.warehouseId);
        if (!warehouse) {
            throw new common_1.NotFoundException('Warehouse không tồn tại');
        }
        const duplicated = await this.locationRepository.findByWarehouseAndCode(dto.warehouseId, dto.code);
        if (duplicated) {
            throw new common_1.ConflictException('Location code đã tồn tại trong warehouse');
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
    async findByWarehouseId(actorUserId, warehouseId) {
        this.contextService.setActorUserId(actorUserId);
        const warehouse = await this.warehouseRepository.findById(warehouseId);
        if (!warehouse) {
            throw new common_1.NotFoundException('Warehouse không tồn tại');
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
};
exports.LocationService = LocationService;
exports.LocationService = LocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [location_repository_1.LocationRepository,
        warehouse_repository_1.WarehouseRepository,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], LocationService);
//# sourceMappingURL=location.service.js.map