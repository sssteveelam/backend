import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { ApprovalService } from '../approval/approval.service';
import { ThresholdService } from '../approval/threshold.service';
import { AppRole } from '../auth/guards/roles.guard';
import { CapacityService } from '../capacity/capacity.service';
import { BatchService } from '../inventory/services/batch.service';
import { ProductUomService } from '../master-data/product-uoms/product-uom.service';
import { ProductRepository } from '../master-data/products/product.repository';
import { SupplierRepository } from '../master-data/suppliers/supplier.repository';
import { WarehouseRepository } from '../master-data/warehouses/warehouse.repository';
import { AddReceiptLineDto } from './dto/add-receipt-line.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SubmitReceiptDto } from './dto/submit-receipt.dto';
import { ReceiptRepository } from './receipt.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptListQueryDto } from './dto/receipt-list-query.dto';
import { ListResponse, buildListResponse } from '../../common/dto/list-response.dto';
import { getPaginationSkipTake } from '../../common/dto/pagination-query.dto';
import { ReceiptListItemDto } from './dto/receipt-list-item.dto';
import { ReceiptDetailDto } from './dto/receipt-detail.dto';
import { ReceiptLineDto } from './dto/receipt-line.dto';

@Injectable()
export class ReceiptService {
  constructor(
    private readonly receiptRepository: ReceiptRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly productRepository: ProductRepository,
    private readonly productUomService: ProductUomService,
    private readonly batchService: BatchService,
    private readonly idempotencyService: IdempotencyService,
    private readonly approvalService: ApprovalService,
    private readonly thresholdService: ThresholdService,
    private readonly capacityService: CapacityService,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
    private readonly prisma: PrismaService,
  ) {}

  // PROPOSED NEW API: GET /receipts
  async listReceipts(query: ReceiptListQueryDto): Promise<ListResponse<ReceiptListItemDto>> {
    if (query.createdFrom && query.createdTo) {
      const from = new Date(query.createdFrom);
      const to = new Date(query.createdTo);
      if (from > to) {
        throw new BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
      }
    }

    const { skip, take } = getPaginationSkipTake({ page: query.page, limit: query.limit });
    const { rows, total } = await this.receiptRepository.listReceipts(query, skip, take);

    return buildListResponse({
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

  // PROPOSED NEW API: GET /receipts/:id
  async getReceiptDetail(receiptId: string): Promise<ReceiptDetailDto> {
    const receipt = await this.receiptRepository.findReceiptWithLinesById(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt không tồn tại');
    }

    const lines: ReceiptLineDto[] = receipt.lines.map((line) => ({
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

  async createReceipt(actorUserId: string, dto: CreateReceiptDto) {
    this.contextService.setActorUserId(actorUserId);

    const supplier = await this.supplierRepository.findById(dto.supplierId);
    if (!supplier) throw new NotFoundException('Supplier không tồn tại');

    const warehouse = await this.warehouseRepository.findById(dto.warehouseId);
    if (!warehouse) throw new NotFoundException('Warehouse không tồn tại');

    const existed = await this.receiptRepository.findReceiptByCode(dto.code);
    if (existed) throw new ConflictException('Receipt code đã tồn tại');

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

  async addLine(actorUserId: string, receiptId: string, dto: AddReceiptLineDto) {
    this.contextService.setActorUserId(actorUserId);

    if (dto.quantity <= 0) throw new BadRequestException('quantity phải > 0');
    if (dto.unitCost < 0) throw new BadRequestException('unit_cost phải >= 0');

    const manufactureDate = new Date(dto.manufactureDate);
    const expiryDate = new Date(dto.expiryDate);
    if (expiryDate <= manufactureDate) {
      throw new BadRequestException('expiry_date phải lớn hơn manufacture_date');
    }

    const receipt = await this.receiptRepository.findReceiptById(receiptId);
    if (!receipt) throw new NotFoundException('Receipt không tồn tại');
    if (receipt.status !== 'draft') throw new ForbiddenException('Chỉ được thêm line khi receipt draft');

    const product = await this.productRepository.findById(dto.productId);
    if (!product) throw new NotFoundException('Product không tồn tại');

    if (dto.supplierId) {
      const supplier = await this.supplierRepository.findById(dto.supplierId);
      if (!supplier) throw new NotFoundException('Supplier không tồn tại');
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

  async submitReceipt(
    actorUserId: string,
    actorRole: AppRole,
    receiptId: string,
    idempotencyKey: string,
    dto: SubmitReceiptDto,
  ) {
    this.contextService.setActorUserId(actorUserId);

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key là bắt buộc');
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
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      }
      if (existedIdem.responseJson) {
        return existedIdem.responseJson;
      }
    }

    const receipt = await this.receiptRepository.findReceiptById(receiptId);
    if (!receipt) throw new NotFoundException('Receipt không tồn tại');
    if (receipt.status === 'submitted') throw new ConflictException('Receipt đã submit');
    if (receipt.status === 'cancelled') throw new ConflictException('Receipt đã cancelled');
    if (actorRole === 'staff' && !dto.overrideCapacity) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const lines = await this.receiptRepository.findReceiptLines(receiptId);
    if (lines.length === 0) throw new BadRequestException('Receipt chưa có line');

    const targetLocation = await this.prisma.location.findFirst({
      where: { warehouseId: receipt.warehouseId },
    });
    if (!targetLocation) throw new BadRequestException('Warehouse chưa có location để nhập kho');

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
        throw new BadRequestException('CAPACITY_OVERRIDE_REASON_REQUIRED');
      }

      if (actorRole === 'staff' && capacityResult.isBigOver) {
        throw new ForbiddenException('BIG_OVER_REQUIRES_APPROVAL');
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
    const warnings: Array<{ lineId: string; warning: string }> = [];

    const submittedResponse = await this.receiptRepository.withTransaction(async (tx) => {
      let totalValue = 0;
      const batchCostAcc = new Map<string, { totalQtyBase: number; totalValueBase: number }>();

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
        if (!location) throw new BadRequestException('Warehouse chưa có location để nhập kho');

        let containerId: string | null = null;
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
              quantityBase: new Prisma.Decimal(existingStock.quantityBase).plus(quantityBase),
            },
          });
        } else {
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

  async cancelReceipt(actorUserId: string, receiptId: string) {
    this.contextService.setActorUserId(actorUserId);

    const receipt = await this.receiptRepository.findReceiptById(receiptId);
    if (!receipt) throw new NotFoundException('Receipt không tồn tại');
    if (receipt.status !== 'draft') {
      throw new BadRequestException('Chỉ được cancel receipt draft');
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
}
