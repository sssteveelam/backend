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
exports.ProductUomRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ProductUomRepository = class ProductUomRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByProductId(productId) {
        return this.prisma.productUom.findMany({
            where: { productId },
            orderBy: [{ supplierId: 'asc' }, { uom: 'asc' }],
        });
    }
    create(data) {
        return this.prisma.productUom.create({ data });
    }
    findDuplicate(params) {
        return this.prisma.productUom.findFirst({
            where: {
                productId: params.productId,
                supplierId: params.supplierId,
                uom: params.uom,
            },
        });
    }
    findForConversion(params) {
        return this.prisma.productUom.findFirst({
            where: {
                productId: params.productId,
                supplierId: params.supplierId,
                uom: params.uom,
            },
        });
    }
};
exports.ProductUomRepository = ProductUomRepository;
exports.ProductUomRepository = ProductUomRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductUomRepository);
//# sourceMappingURL=product-uom.repository.js.map