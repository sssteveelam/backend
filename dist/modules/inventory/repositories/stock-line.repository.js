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
exports.StockLineRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let StockLineRepository = class StockLineRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findInventory(input) {
        return this.prisma.stockLine.findMany({
            where: {
                productId: input.productId,
                locationId: input.locationId,
            },
            include: {
                product: true,
                batch: {
                    include: {
                        supplier: true,
                    },
                },
                location: true,
                container: true,
            },
            orderBy: [{ createdAt: 'desc' }],
        });
    }
    findNearExpiry(days) {
        const now = new Date();
        const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        return this.prisma.stockLine.findMany({
            where: {
                batch: {
                    expiryDate: {
                        lte: target,
                    },
                },
            },
            include: {
                product: true,
                batch: {
                    include: {
                        supplier: true,
                    },
                },
                location: true,
                container: true,
            },
            orderBy: {
                batch: {
                    expiryDate: 'asc',
                },
            },
        });
    }
    findByLocationCode(locationCode) {
        return this.prisma.stockLine.findMany({
            where: {
                location: {
                    code: locationCode,
                },
            },
            include: {
                product: true,
                batch: {
                    include: {
                        supplier: true,
                    },
                },
                location: true,
                container: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    findSuggestions(input) {
        return this.prisma.stockLine.findMany({
            where: {
                productId: input.productId,
                locationId: input.locationId,
                location: input.warehouseId
                    ? {
                        warehouseId: input.warehouseId,
                    }
                    : undefined,
                quantityBase: {
                    gt: 0,
                },
            },
            include: {
                product: true,
                batch: {
                    include: {
                        supplier: true,
                    },
                },
                location: true,
                container: true,
            },
            orderBy: [
                {
                    batch: {
                        expiryDate: 'asc',
                    },
                },
                {
                    quantityBase: 'desc',
                },
            ],
            take: input.limit || 10,
        });
    }
};
exports.StockLineRepository = StockLineRepository;
exports.StockLineRepository = StockLineRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockLineRepository);
//# sourceMappingURL=stock-line.repository.js.map