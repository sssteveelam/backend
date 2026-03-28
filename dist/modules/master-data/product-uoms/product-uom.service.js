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
exports.ProductUomService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const supplier_repository_1 = require("../suppliers/supplier.repository");
const product_repository_1 = require("../products/product.repository");
const product_uom_repository_1 = require("./product-uom.repository");
let ProductUomService = class ProductUomService {
    constructor(productUomRepository, productRepository, supplierRepository, auditService, contextService) {
        this.productUomRepository = productUomRepository;
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async findByProductId(actorUserId, productId) {
        this.contextService.setActorUserId(actorUserId);
        const product = await this.productRepository.findById(productId);
        if (!product) {
            throw new common_1.NotFoundException('Product không tồn tại');
        }
        const uoms = await this.productUomRepository.findByProductId(productId);
        await this.auditService.logEvent({
            action: 'VIEW_PRODUCT_UOMS',
            entity_type: 'product_uoms',
            entity_id: undefined,
            before: null,
            after: { productId, count: uoms.length },
            reason: 'List product uoms',
        });
        return uoms;
    }
    async create(actorUserId, productId, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (dto.factorToBase <= 0) {
            throw new common_1.BadRequestException('factor_to_base phải > 0');
        }
        const product = await this.productRepository.findById(productId);
        if (!product) {
            throw new common_1.NotFoundException('Product không tồn tại');
        }
        if (dto.supplierId) {
            const supplier = await this.supplierRepository.findById(dto.supplierId);
            if (!supplier) {
                throw new common_1.NotFoundException('Supplier không tồn tại');
            }
        }
        const duplicated = await this.productUomRepository.findDuplicate({
            productId,
            supplierId: dto.supplierId ?? null,
            uom: dto.uom,
        });
        if (duplicated) {
            throw new common_1.ConflictException('Product UoM đã tồn tại với product/supplier/uom này');
        }
        const created = await this.productUomRepository.create({
            uom: dto.uom,
            factorToBase: dto.factorToBase,
            product: {
                connect: { id: productId },
            },
            supplier: dto.supplierId
                ? {
                    connect: { id: dto.supplierId },
                }
                : undefined,
        });
        await this.auditService.logEvent({
            action: 'CREATE_PRODUCT_UOM',
            entity_type: 'product_uoms',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Create product UoM',
        });
        return created;
    }
    async resolveConversion(params) {
        const direct = await this.productUomRepository.findForConversion({
            productId: params.productId,
            supplierId: params.supplierId,
            uom: params.uom,
        });
        if (direct) {
            return direct;
        }
        const fallback = await this.productUomRepository.findForConversion({
            productId: params.productId,
            supplierId: null,
            uom: params.uom,
        });
        if (fallback) {
            return fallback;
        }
        throw new common_1.NotFoundException('Không tìm thấy quy đổi UoM cho product/supplier');
    }
};
exports.ProductUomService = ProductUomService;
exports.ProductUomService = ProductUomService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [product_uom_repository_1.ProductUomRepository,
        product_repository_1.ProductRepository,
        supplier_repository_1.SupplierRepository,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], ProductUomService);
//# sourceMappingURL=product-uom.service.js.map