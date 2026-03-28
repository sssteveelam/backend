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
exports.CycleCountRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CycleCountRepository = class CycleCountRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    createCycleCount(data) {
        return this.prisma.cycleCount.create({ data });
    }
    findById(id) {
        return this.prisma.cycleCount.findUnique({ where: { id } });
    }
    findByCode(code) {
        return this.prisma.cycleCount.findUnique({ where: { code } });
    }
    createLine(data) {
        return this.prisma.cycleCountLine.create({ data });
    }
    findLines(cycleCountId) {
        return this.prisma.cycleCountLine.findMany({
            where: { cycleCountId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async listCycleCounts(query, skip, take) {
        const where = {
            ...(query.status ? { status: query.status } : null),
            ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
            ...(query.locationId ? { locationId: query.locationId } : null),
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
            this.prisma.cycleCount.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.cycleCount.count({ where }),
        ]);
        return { rows, total };
    }
    findCycleCountWithLinesById(id) {
        return this.prisma.cycleCount.findUnique({
            where: { id },
            include: {
                lines: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }
    withTransaction(callback) {
        return this.prisma.$transaction((tx) => callback(tx));
    }
};
exports.CycleCountRepository = CycleCountRepository;
exports.CycleCountRepository = CycleCountRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CycleCountRepository);
//# sourceMappingURL=cycle-count.repository.js.map