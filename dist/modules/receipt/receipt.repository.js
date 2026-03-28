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
exports.ReceiptRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReceiptRepository = class ReceiptRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    createReceipt(data) {
        return this.prisma.receipt.create({ data });
    }
    findReceiptById(id) {
        return this.prisma.receipt.findUnique({ where: { id } });
    }
    findReceiptByCode(code) {
        return this.prisma.receipt.findUnique({ where: { code } });
    }
    createReceiptLine(data) {
        return this.prisma.receiptLine.create({ data });
    }
    findReceiptLines(receiptId) {
        return this.prisma.receiptLine.findMany({
            where: { receiptId },
            orderBy: { createdAt: 'asc' },
        });
    }
    findReceiptWithLinesById(id) {
        return this.prisma.receipt.findUnique({
            where: { id },
            include: {
                lines: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }
    async listReceipts(query, skip, take) {
        const where = {
            ...(query.status ? { status: query.status } : null),
            ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
            ...(query.supplierId ? { supplierId: query.supplierId } : null),
            ...(query.warehouseId ? { warehouseId: query.warehouseId } : null),
            ...(query.createdFrom || query.createdTo
                ? {
                    createdAt: {
                        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : null),
                        ...(query.createdTo ? { lte: new Date(query.createdTo) } : null),
                    },
                }
                : null),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.receipt.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.receipt.count({ where }),
        ]);
        return { rows, total };
    }
    async withTransaction(callback) {
        return this.prisma.$transaction(async (tx) => callback(tx));
    }
};
exports.ReceiptRepository = ReceiptRepository;
exports.ReceiptRepository = ReceiptRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReceiptRepository);
//# sourceMappingURL=receipt.repository.js.map