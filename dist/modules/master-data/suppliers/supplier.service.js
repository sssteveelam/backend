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
exports.SupplierService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const supplier_repository_1 = require("./supplier.repository");
let SupplierService = class SupplierService {
    constructor(supplierRepository, auditService, contextService) {
        this.supplierRepository = supplierRepository;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async create(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existed = await this.supplierRepository.findByCode(dto.code);
        if (existed) {
            throw new common_1.ConflictException('Supplier code đã tồn tại');
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
    async findAll(actorUserId) {
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
    async findById(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const supplier = await this.supplierRepository.findById(id);
        if (!supplier) {
            throw new common_1.NotFoundException('Supplier không tồn tại');
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
    async update(actorUserId, id, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.supplierRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Supplier không tồn tại');
        }
        if (dto.code && dto.code !== existing.code) {
            const codeExisted = await this.supplierRepository.findByCode(dto.code);
            if (codeExisted) {
                throw new common_1.ConflictException('Supplier code đã tồn tại');
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
    async remove(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.supplierRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Supplier không tồn tại');
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
};
exports.SupplierService = SupplierService;
exports.SupplierService = SupplierService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supplier_repository_1.SupplierRepository,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], SupplierService);
//# sourceMappingURL=supplier.service.js.map