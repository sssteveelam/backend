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
exports.BatchService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const context_service_1 = require("../../context/context.service");
const product_repository_1 = require("../../master-data/products/product.repository");
const supplier_repository_1 = require("../../master-data/suppliers/supplier.repository");
const batch_repository_1 = require("../repositories/batch.repository");
let BatchService = class BatchService {
    constructor(batchRepository, productRepository, supplierRepository, contextService, auditService) {
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.contextService = contextService;
        this.auditService = auditService;
    }
    async getOrCreateBatchId(input) {
        this.contextService.setActorUserId(input.actorUserId);
        if (input.expiryDate <= input.manufactureDate) {
            throw new common_1.BadRequestException('expiry_date phải lớn hơn manufacture_date');
        }
        const product = await this.productRepository.findById(input.productId);
        if (!product) {
            throw new common_1.NotFoundException('Product không tồn tại');
        }
        if (input.supplierId) {
            const supplier = await this.supplierRepository.findById(input.supplierId);
            if (!supplier) {
                throw new common_1.NotFoundException('Supplier không tồn tại');
            }
        }
        const existed = await this.batchRepository.findComposite({
            productId: input.productId,
            supplierId: input.supplierId,
            manufactureDate: input.manufactureDate,
            expiryDate: input.expiryDate,
            lotCode: input.lotCode,
        });
        if (existed) {
            return existed.id;
        }
        const created = await this.batchRepository.create({
            lotCode: input.lotCode,
            manufactureDate: input.manufactureDate,
            expiryDate: input.expiryDate,
            product: { connect: { id: input.productId } },
            supplier: input.supplierId ? { connect: { id: input.supplierId } } : undefined,
        });
        await this.auditService.logEvent({
            action: 'CREATE_BATCH',
            entity_type: 'batches',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Create batch by identity',
        });
        return created.id;
    }
    async viewBatches(actorUserId, input) {
        this.contextService.setActorUserId(actorUserId);
        const batches = await this.batchRepository.findMany(input);
        await this.auditService.logEvent({
            action: 'VIEW_BATCHES',
            entity_type: 'batches',
            before: null,
            after: { count: batches.length },
            reason: 'View batches',
        });
        return batches;
    }
};
exports.BatchService = BatchService;
exports.BatchService = BatchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [batch_repository_1.BatchRepository,
        product_repository_1.ProductRepository,
        supplier_repository_1.SupplierRepository,
        context_service_1.ContextService,
        audit_service_1.AuditService])
], BatchService);
//# sourceMappingURL=batch.service.js.map