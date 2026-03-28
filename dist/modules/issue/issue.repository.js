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
exports.IssueRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let IssueRepository = class IssueRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listIssues(query, skip, take) {
        const where = {
            ...(query.status ? { status: query.status } : null),
            ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
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
            this.prisma.issue.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.issue.count({ where }),
        ]);
        return { rows, total };
    }
    findIssueWithLinesById(issueId) {
        return this.prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                lines: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }
    async listPickTasksByIssue(issueId, query, skip, take) {
        const where = {
            issueLine: {
                issueId,
            },
            ...(query.status ? { status: query.status } : null),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.pickTask.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.pickTask.count({ where }),
        ]);
        return { rows, total };
    }
    withTransaction(callback) {
        return this.prisma.$transaction(async (tx) => callback(tx));
    }
};
exports.IssueRepository = IssueRepository;
exports.IssueRepository = IssueRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IssueRepository);
//# sourceMappingURL=issue.repository.js.map