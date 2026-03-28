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
exports.IdempotencyRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let IdempotencyRepository = class IdempotencyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(input) {
        return this.prisma.idempotencyKey.create({
            data: {
                actorUserId: input.actorUserId,
                route: input.route,
                key: input.key,
                requestHash: input.requestHash,
                responseJson: input.responseJson,
            },
        });
    }
    async updateResponse(input) {
        return this.prisma.idempotencyKey.update({
            where: { id: input.id },
            data: { responseJson: input.responseJson },
        });
    }
    findOne(input) {
        return this.prisma.idempotencyKey.findFirst({
            where: {
                route: input.route,
                key: input.key,
                actorUserId: input.actorUserId,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.IdempotencyRepository = IdempotencyRepository;
exports.IdempotencyRepository = IdempotencyRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IdempotencyRepository);
//# sourceMappingURL=idempotency.repository.js.map