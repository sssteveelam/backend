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
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const product_repository_1 = require("./product.repository");
let ProductService = class ProductService {
    constructor(productRepository, auditService, contextService) {
        this.productRepository = productRepository;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async create(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existed = await this.productRepository.findByCode(dto.code);
        if (existed) {
            throw new common_1.ConflictException('Product code đã tồn tại');
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
    async findAll(actorUserId) {
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
    async findById(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new common_1.NotFoundException('Product không tồn tại');
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
    async update(actorUserId, id, dto) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.productRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Product không tồn tại');
        }
        if (dto.code && dto.code !== existing.code) {
            const codeExisted = await this.productRepository.findByCode(dto.code);
            if (codeExisted) {
                throw new common_1.ConflictException('Product code đã tồn tại');
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
    async remove(actorUserId, id) {
        this.contextService.setActorUserId(actorUserId);
        const existing = await this.productRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Product không tồn tại');
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
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [product_repository_1.ProductRepository,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], ProductService);
//# sourceMappingURL=product.service.js.map