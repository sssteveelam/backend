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
exports.IdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const idempotency_repository_1 = require("./idempotency.repository");
let IdempotencyService = class IdempotencyService {
    constructor(idempotencyRepository) {
        this.idempotencyRepository = idempotencyRepository;
    }
    hashRequestBody(requestBody) {
        return (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(requestBody ?? {}))
            .digest('hex');
    }
    async saveKey(input) {
        const requestHash = this.hashRequestBody(input.requestBody);
        const existed = await this.idempotencyRepository.findOne({
            actorUserId: input.actorUserId,
            route: input.route,
            key: input.key,
        });
        if (existed) {
            if (existed.requestHash !== requestHash) {
                throw new common_1.ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
            }
            return;
        }
        await this.idempotencyRepository.create({
            actorUserId: input.actorUserId,
            route: input.route,
            key: input.key,
            requestHash,
        });
    }
    findOne(input) {
        return this.idempotencyRepository.findOne(input);
    }
    createWithResponse(input) {
        const requestHash = this.hashRequestBody(input.requestBody);
        return this.findOne({
            actorUserId: input.actorUserId,
            route: input.route,
            key: input.key,
        }).then((existing) => {
            if (!existing) {
                return this.idempotencyRepository.create({
                    actorUserId: input.actorUserId,
                    route: input.route,
                    key: input.key,
                    requestHash,
                    responseJson: input.responseJson,
                });
            }
            return this.idempotencyRepository.updateResponse({
                id: existing.id,
                responseJson: input.responseJson,
            });
        });
    }
};
exports.IdempotencyService = IdempotencyService;
exports.IdempotencyService = IdempotencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [idempotency_repository_1.IdempotencyRepository])
], IdempotencyService);
//# sourceMappingURL=idempotency.service.js.map