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
exports.ReceiptService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
const idempotency_service_1 = require("../idempotency/idempotency.service");
const approval_service_1 = require("../approval/approval.service");
const threshold_service_1 = require("../approval/threshold.service");
const capacity_service_1 = require("../capacity/capacity.service");
const batch_service_1 = require("../inventory/services/batch.service");
const product_uom_service_1 = require("../master-data/product-uoms/product-uom.service");
const product_repository_1 = require("../master-data/products/product.repository");
const supplier_repository_1 = require("../master-data/suppliers/supplier.repository");
const warehouse_repository_1 = require("../master-data/warehouses/warehouse.repository");
const receipt_repository_1 = require("./receipt.repository");
const prisma_service_1 = require("../prisma/prisma.service");
const list_response_dto_1 = require("../../common/dto/list-response.dto");
const pagination_query_dto_1 = require("../../common/dto/pagination-query.dto");
let ReceiptService = class ReceiptService {
    constructor(receiptRepository, supplierRepository, warehouseRepository, productRepository, productUomService, batchService, idempotencyService, approvalService, thresholdService, capacityService, auditService, contextService, prisma) {
        this.receiptRepository = receiptRepository;
        this.supplierRepository = supplierRepository;
        this.warehouseRepository = warehouseRepository;
        this.productRepository = productRepository;
        this.productUomService = productUomService;
        this.batchService = batchService;
        this.idempotencyService = idempotencyService;
        this.approvalService = approvalService;
        this.thresholdService = thresholdService;
        this.capacityService = capacityService;
        this.auditService = auditService;
        this.contextService = contextService;
        this.prisma = prisma;
    }
    async listReceipts(query) {
        if (query.createdFrom && query.createdTo) {
            const from = new Date(query.createdFrom);
            const to = new Date(query.createdTo);
            if (from > to) {
                throw new common_1.BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
            }
        }
        const { skip, take } = (0, pagination_query_dto_1.getPaginationSkipTake)({ page: query.page, limit: query.limit });
        const { rows, total } = await this.receiptRepository.listReceipts(query, skip, take);
        return (0, list_response_dto_1.buildListResponse)({
            data: rows.map((row) => ({
                id: row.id,
                code: row.code,
                status: row.status,
                supplierId: row.supplierId,
                warehouseId: row.warehouseId,
                totalValue: row.totalValue.toString(),
                createdBy: row.createdBy,
                createdAt: row.createdAt.toISOString(),
            })),
            page: query.page,
            limit: query.limit,
            total,
        });
    }
    async getReceiptDetail(receiptId) {
        const receipt = await this.receiptRepository.findReceiptWithLinesById(receiptId);
        if (!receipt) {
            throw new common_1.NotFoundException('Receipt không tồn tại');
        }
        const lines = receipt.lines.map((line) => ({
            id: line.id,
            receiptId: line.receiptId,
            productId: line.productId,
            supplierId: line.supplierId,
            batchId: line.batchId,
            quantity: line.quantity.toString(),
            quantityBase: line.quantityBase ? line.quantityBase.toString() : null,
            uom: line.uom,
            unitCost: line.unitCost.toString(),
            manufactureDate: line.manufactureDate.toISOString(),
            expiryDate: line.expiryDate.toISOString(),
            lotCode: line.lotCode,
            containerQrCode: line.containerQrCode,
            createdAt: line.createdAt.toISOString(),
        }));
        return {
            id: receipt.id,
            code: receipt.code,
            status: receipt.status,
            supplierId: receipt.supplierId,
            warehouseId: receipt.warehouseId,
            totalValue: receipt.totalValue.toString(),
            createdBy: receipt.createdBy,
            createdAt: receipt.createdAt.toISOString(),
            lines,
        };
    }
    async createReceipt(actorUserId, dto) {
        this.contextService.setActorUserId(actorUserId);
        const supplier = await this.supplierRepository.findById(dto.supplierId);
        if (!supplier)
            throw new common_1.NotFoundException('Supplier không tồn tại');
        const warehouse = await this.warehouseRepository.findById(dto.warehouseId);
        if (!warehouse)
            throw new common_1.NotFoundException('Warehouse không tồn tại');
        const existed = await this.receiptRepository.findReceiptByCode(dto.code);
        if (existed)
            throw new common_1.ConflictException('Receipt code đã tồn tại');
        const created = await this.receiptRepository.createReceipt({
            code: dto.code,
            status: 'draft',
            totalValue: 0,
            supplier: { connect: { id: dto.supplierId } },
            warehouse: { connect: { id: dto.warehouseId } },
            creator: { connect: { id: actorUserId } },
        });
        await this.auditService.logEvent({
            action: 'CREATE_RECEIPT',
            entity_type: 'receipts',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Create receipt draft',
        });
        return created;
    }
    async addLine(actorUserId, receiptId, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (dto.quantity <= 0)
            throw new common_1.BadRequestException('quantity phải > 0');
        if (dto.unitCost < 0)
            throw new common_1.BadRequestException('unit_cost phải >= 0');
        const manufactureDate = new Date(dto.manufactureDate);
        const expiryDate = new Date(dto.expiryDate);
        if (expiryDate <= manufactureDate) {
            throw new common_1.BadRequestException('expiry_date phải lớn hơn manufacture_date');
        }
        const receipt = await this.receiptRepository.findReceiptById(receiptId);
        if (!receipt)
            throw new common_1.NotFoundException('Receipt không tồn tại');
        if (receipt.status !== 'draft')
            throw new common_1.ForbiddenException('Chỉ được thêm line khi receipt draft');
        const product = await this.productRepository.findById(dto.productId);
        if (!product)
            throw new common_1.NotFoundException('Product không tồn tại');
        if (dto.supplierId) {
            const supplier = await this.supplierRepository.findById(dto.supplierId);
            if (!supplier)
                throw new common_1.NotFoundException('Supplier không tồn tại');
        }
        const created = await this.receiptRepository.createReceiptLine({
            quantity: dto.quantity,
            uom: dto.uom,
            unitCost: dto.unitCost,
            manufactureDate,
            expiryDate,
            lotCode: dto.lotCode,
            containerQrCode: dto.containerQrCode,
            receipt: { connect: { id: receiptId } },
            product: { connect: { id: dto.productId } },
            supplier: dto.supplierId ? { connect: { id: dto.supplierId } } : undefined,
        });
        await this.auditService.logEvent({
            action: 'ADD_RECEIPT_LINE',
            entity_type: 'receipt_lines',
            entity_id: created.id,
            before: null,
            after: created,
            reason: 'Add receipt line',
        });
        return created;
    }
    async submitReceipt(actorUserId, actorRole, receiptId, idempotencyKey, dto) {
        this.contextService.setActorUserId(actorUserId);
        if (!idempotencyKey) {
            throw new common_1.BadRequestException('Idempotency-Key là bắt buộc');
        }
        const route = `/receipts/${receiptId}/submit`;
        const existedIdem = await this.idempotencyService.findOne({
            actorUserId,
            route,
            key: idempotencyKey,
        });
        if (existedIdem) {
            const currentRequestHash = this.idempotencyService.hashRequestBody({ receiptId, ...dto });
            if (existedIdem.requestHash !== currentRequestHash) {
                throw new common_1.ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
            }
            if (existedIdem.responseJson) {
                return existedIdem.responseJson;
            }
        }
        const receipt = await this.receiptRepository.findReceiptById(receiptId);
        if (!receipt)
            throw new common_1.NotFoundException('Receipt không tồn tại');
        if (receipt.status === 'submitted')
            throw new common_1.ConflictException('Receipt đã submit');
        if (receipt.status === 'cancelled')
            throw new common_1.ConflictException('Receipt đã cancelled');
        if (actorRole === 'staff' && !dto.overrideCapacity) {
            throw new common_1.ForbiddenException('Không có quyền truy cập');
        }
        const lines = await this.receiptRepository.findReceiptLines(receiptId);
        if (lines.length === 0)
            throw new common_1.BadRequestException('Receipt chưa có line');
        const targetLocation = await this.prisma.location.findFirst({
            where: { warehouseId: receipt.warehouseId },
        });
        if (!targetLocation)
            throw new common_1.BadRequestException('Warehouse chưa có location để nhập kho');
        const currentLocationStock = await this.prisma.stockLine.aggregate({
            where: { locationId: targetLocation.id },
            _sum: { quantityBase: true },
        });
        const incomingBaseQuantity = await lines.reduce(async (accPromise, line) => {
            const acc = await accPromise;
            const conversion = await this.productUomService.resolveConversion({
                productId: line.productId,
                supplierId: line.supplierId,
                uom: line.uom,
            });
            return acc + Number(line.quantity) * Number(conversion.factorToBase);
        }, Promise.resolve(0));
        const capacityResult = this.capacityService.check({
            locationId: targetLocation.id,
            capacityLimit: targetLocation.capacityLimitBase ? Number(targetLocation.capacityLimitBase) : null,
            incomingQuantity: incomingBaseQuantity,
            currentStock: Number(currentLocationStock._sum.quantityBase ?? 0),
        });
        const capacityWarning = {
            isOver: capacityResult.isOver,
            isBigOver: capacityResult.isBigOver,
            message: capacityResult.warningMessage,
        };
        const overrideRequested = Boolean(dto.overrideCapacity);
        const capacityOverrideApplied = capacityResult.isOver && overrideRequested;
        if (capacityResult.isOver) {
            await this.auditService.logEvent({
                action: 'CAPACITY_WARNING',
                entity_type: 'receipts',
                entity_id: receipt.id,
                before: {
                    locationId: targetLocation.id,
                    currentStock: Number(currentLocationStock._sum.quantityBase ?? 0),
                },
                after: {
                    locationId: targetLocation.id,
                    incomingQuantity: incomingBaseQuantity,
                    newTotal: capacityResult.newTotal,
                    overPercentage: capacityResult.overPercentage,
                    overAmount: capacityResult.overAmount,
                    isBigOver: capacityResult.isBigOver,
                },
                reason: dto.overrideReason,
            });
        }
        if (capacityResult.isBigOver && !overrideRequested) {
            const approvalRequest = await this.approvalService.createApprovalRequest({
                actorUserId,
                documentType: 'receipt',
                documentId: receipt.id,
                thresholdSnapshot: {
                    capacity: {
                        isOver: capacityResult.isOver,
                        isBigOver: capacityResult.isBigOver,
                        overPercentage: capacityResult.overPercentage,
                        overAmount: capacityResult.overAmount,
                        warningMessage: capacityResult.warningMessage,
                    },
                },
                reason: 'Capacity BIG_OVER requires approval',
            });
            const blockedResponse = {
                receipt: {
                    ...receipt,
                    totalValue: receipt.totalValue.toString(),
                },
                warnings: [],
                blocked: true,
                approvalRequestId: approvalRequest.id,
                capacityWarning,
                overrideRequired: true,
            };
            await this.idempotencyService.createWithResponse({
                actorUserId,
                route,
                key: idempotencyKey,
                requestBody: { receiptId, ...dto },
                responseJson: blockedResponse,
            });
            return blockedResponse;
        }
        if (capacityResult.isOver) {
            if (!overrideRequested) {
                const softBlockedResponse = {
                    receipt: {
                        ...receipt,
                        totalValue: receipt.totalValue.toString(),
                    },
                    warnings: [],
                    blocked: false,
                    approvalRequestId: null,
                    capacityWarning,
                    overrideRequired: true,
                };
                await this.idempotencyService.createWithResponse({
                    actorUserId,
                    route,
                    key: idempotencyKey,
                    requestBody: { receiptId, ...dto },
                    responseJson: softBlockedResponse,
                });
                return softBlockedResponse;
            }
            if (!dto.overrideReason?.trim()) {
                throw new common_1.BadRequestException('CAPACITY_OVERRIDE_REASON_REQUIRED');
            }
            if (actorRole === 'staff' && capacityResult.isBigOver) {
                throw new common_1.ForbiddenException('BIG_OVER_REQUIRES_APPROVAL');
            }
            await this.auditService.logEvent({
                action: 'CAPACITY_OVERRIDE',
                entity_type: 'receipts',
                entity_id: receipt.id,
                before: {
                    locationId: targetLocation.id,
                    currentStock: Number(currentLocationStock._sum.quantityBase ?? 0),
                },
                after: {
                    locationId: targetLocation.id,
                    incomingQuantity: incomingBaseQuantity,
                    newTotal: capacityResult.newTotal,
                    overPercentage: capacityResult.overPercentage,
                    overAmount: capacityResult.overAmount,
                    isBigOver: capacityResult.isBigOver,
                },
                reason: dto.overrideReason,
            });
        }
        const beforeReceipt = receipt;
        const warnings = [];
        const submittedResponse = await this.receiptRepository.withTransaction(async (tx) => {
            let totalValue = 0;
            const batchCostAcc = new Map();
            for (const line of lines) {
                const conversion = await this.productUomService.resolveConversion({
                    productId: line.productId,
                    supplierId: line.supplierId,
                    uom: line.uom,
                });
                const quantityBase = Number(line.quantity) * Number(conversion.factorToBase);
                const batchId = await this.batchService.getOrCreateBatchId({
                    actorUserId,
                    productId: line.productId,
                    supplierId: line.supplierId,
                    manufactureDate: line.manufactureDate,
                    expiryDate: line.expiryDate,
                    lotCode: line.lotCode,
                });
                const location = await tx.location.findFirst({ where: { warehouseId: receipt.warehouseId } });
                if (!location)
                    throw new common_1.BadRequestException('Warehouse chưa có location để nhập kho');
                let containerId = null;
                if (line.containerQrCode) {
                    const c = await tx.container.upsert({
                        where: { qrCode: line.containerQrCode },
                        update: { locationId: location.id },
                        create: {
                            qrCode: line.containerQrCode,
                            locationId: location.id,
                        },
                    });
                    containerId = c.id;
                }
                const existingStock = await tx.stockLine.findFirst({
                    where: {
                        productId: line.productId,
                        batchId,
                        locationId: location.id,
                        containerId,
                    },
                });
                const beforeStock = existingStock;
                let updatedStock;
                if (existingStock) {
                    updatedStock = await tx.stockLine.update({
                        where: { id: existingStock.id },
                        data: {
                            quantityBase: new client_1.Prisma.Decimal(existingStock.quantityBase).plus(quantityBase),
                        },
                    });
                }
                else {
                    updatedStock = await tx.stockLine.create({
                        data: {
                            productId: line.productId,
                            batchId,
                            locationId: location.id,
                            containerId,
                            quantityBase,
                        },
                    });
                }
                await tx.receiptLine.update({
                    where: { id: line.id },
                    data: {
                        quantityBase,
                        batchId,
                    },
                });
                const acc = batchCostAcc.get(batchId) ?? { totalQtyBase: 0, totalValueBase: 0 };
                acc.totalQtyBase += quantityBase;
                acc.totalValueBase += quantityBase * Number(line.unitCost);
                batchCostAcc.set(batchId, acc);
                await this.auditService.logEvent({
                    action: 'UPDATE_STOCK_LINE_FROM_RECEIPT',
                    entity_type: 'stock_lines',
                    entity_id: updatedStock.id,
                    before: beforeStock,
                    after: updatedStock,
                    reason: 'Receipt submit stock update',
                });
                totalValue += Number(line.quantity) * Number(line.unitCost);
                const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                if (line.expiryDate <= sevenDaysLater) {
                    warnings.push({ lineId: line.id, warning: 'Near expiry (<= 7 days)' });
                }
            }
            for (const [batchId, acc] of batchCostAcc.entries()) {
                const avgCost = acc.totalQtyBase > 0 ? acc.totalValueBase / acc.totalQtyBase : 0;
                await tx.batch.update({
                    where: { id: batchId },
                    data: { averageCost: avgCost },
                });
            }
            const updatedReceipt = await tx.receipt.update({
                where: { id: receipt.id },
                data: {
                    status: 'submitted',
                    totalValue,
                },
            });
            return {
                receipt: {
                    ...updatedReceipt,
                    totalValue: updatedReceipt.totalValue.toString(),
                },
                warnings,
            };
        });
        await this.auditService.logEvent({
            action: 'SUBMIT_RECEIPT',
            entity_type: 'receipts',
            entity_id: receipt.id,
            before: beforeReceipt,
            after: submittedResponse.receipt,
            reason: 'Submit receipt',
        });
        const submittedLines = await this.receiptRepository.findReceiptLines(receiptId);
        const threshold = capacityOverrideApplied
            ? { requiresApproval: false, snapshot: null }
            : await this.thresholdService.evaluate({
                actorUserId: receipt.createdBy,
                documentType: 'receipt',
                documentValue: Number(submittedResponse.receipt.totalValue),
                lines: submittedLines.map((line) => ({
                    quantityBase: Number(line.quantityBase ?? 0),
                })),
            });
        let approvalRequest = null;
        if (threshold.requiresApproval && threshold.snapshot) {
            approvalRequest = await this.approvalService.createApprovalRequest({
                actorUserId,
                documentType: 'receipt',
                documentId: receipt.id,
                thresholdSnapshot: threshold.snapshot,
            });
        }
        const finalResponse = {
            ...submittedResponse,
            blocked: threshold.requiresApproval,
            approvalRequestId: approvalRequest?.id ?? null,
            capacityWarning,
            overrideRequired: false,
        };
        await this.idempotencyService.createWithResponse({
            actorUserId,
            route,
            key: idempotencyKey,
            requestBody: { receiptId, ...dto },
            responseJson: finalResponse,
        });
        return finalResponse;
    }
    async cancelReceipt(actorUserId, receiptId) {
        this.contextService.setActorUserId(actorUserId);
        const receipt = await this.receiptRepository.findReceiptById(receiptId);
        if (!receipt)
            throw new common_1.NotFoundException('Receipt không tồn tại');
        if (receipt.status !== 'draft') {
            throw new common_1.BadRequestException('Chỉ được cancel receipt draft');
        }
        const updated = await this.prisma.receipt.update({
            where: { id: receiptId },
            data: { status: 'cancelled' },
        });
        await this.auditService.logEvent({
            action: 'CANCEL_RECEIPT',
            entity_type: 'receipts',
            entity_id: receipt.id,
            before: receipt,
            after: updated,
            reason: 'Cancel receipt',
        });
        return updated;
    }
};
exports.ReceiptService = ReceiptService;
exports.ReceiptService = ReceiptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [receipt_repository_1.ReceiptRepository,
        supplier_repository_1.SupplierRepository,
        warehouse_repository_1.WarehouseRepository,
        product_repository_1.ProductRepository,
        product_uom_service_1.ProductUomService,
        batch_service_1.BatchService,
        idempotency_service_1.IdempotencyService,
        approval_service_1.ApprovalService,
        threshold_service_1.ThresholdService,
        capacity_service_1.CapacityService,
        audit_service_1.AuditService,
        context_service_1.ContextService,
        prisma_service_1.PrismaService])
], ReceiptService);
//# sourceMappingURL=receipt.service.js.map