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
exports.AuditRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let AuditRepository = class AuditRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createEvent(data) {
        const beforeJson = data.beforeJson === null ? client_1.Prisma.JsonNull : data.beforeJson;
        const afterJson = data.afterJson === null ? client_1.Prisma.JsonNull : data.afterJson;
        await this.prisma.auditEvent.create({
            data: {
                actorUserId: data.actorUserId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                beforeJson,
                afterJson,
                reason: data.reason,
                correlationId: data.correlationId,
            },
        });
    }
    async listAuditEvents(query, skip, take) {
        const where = {
            ...(query.entityType ? { entityType: query.entityType } : null),
            ...(query.entityId ? { entityId: query.entityId } : null),
            ...(query.actorUserId ? { actorUserId: query.actorUserId } : null),
            ...(query.action ? { action: query.action } : null),
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
            this.prisma.auditEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.auditEvent.count({ where }),
        ]);
        return { rows, total };
    }
};
exports.AuditRepository = AuditRepository;
exports.AuditRepository = AuditRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditRepository);
//# sourceMappingURL=audit.repository.js.map