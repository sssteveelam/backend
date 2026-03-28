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
exports.WarehouseService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const warehouse_repository_1 = require("./warehouse.repository");
let WarehouseService = class WarehouseService {
    constructor(warehouseRepository, auditService, contextService) {
        this.warehouseRepository = warehouseRepository;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async create(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existedCode = await this.warehouseRepository.findByCode(dto.code);
        if (existedCode) {
            throw new common_1.ConflictException('Warehouse code đã tồn tại');
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
    async findAll(actorUserId) {
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
    async findById(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const warehouse = await this.warehouseRepository.findById(id);
        if (!warehouse) {
            throw new common_1.NotFoundException('Warehouse không tồn tại');
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
    async update(actorUserId, id, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.warehouseRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Warehouse không tồn tại');
        }
        if (dto.code && dto.code !== existing.code) {
            const codeExisted = await this.warehouseRepository.findByCode(dto.code);
            if (codeExisted) {
                throw new common_1.ConflictException('Warehouse code đã tồn tại');
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
    async remove(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.warehouseRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Warehouse không tồn tại');
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
};
exports.WarehouseService = WarehouseService;
exports.WarehouseService = WarehouseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [warehouse_repository_1.WarehouseRepository,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], WarehouseService);
//# sourceMappingURL=warehouse.service.js.map