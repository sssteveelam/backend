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
exports.IdempotencyMiddleware = void 0;
const common_1 = require("@nestjs/common");
const context_service_1 = require("../modules/context/context.service");
const idempotency_service_1 = require("../modules/idempotency/idempotency.service");
let IdempotencyMiddleware = class IdempotencyMiddleware {
    constructor(contextService, idempotencyService) {
        this.contextService = contextService;
        this.idempotencyService = idempotencyService;
    }
    async use(req, _res, next) {
        const idempotencyKey = req.header('Idempotency-Key');
        if (!idempotencyKey) {
            next();
            return;
        }
        const context = this.contextService.get();
        const actorUserId = req.user?.id || context.actorUserId;
        if (!actorUserId) {
            next();
            return;
        }
        await this.idempotencyService.saveKey({
            actorUserId,
            route: req.path,
            key: idempotencyKey,
            requestBody: req.body,
        });
        next();
    }
};
exports.IdempotencyMiddleware = IdempotencyMiddleware;
exports.IdempotencyMiddleware = IdempotencyMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_service_1.ContextService,
        idempotency_service_1.IdempotencyService])
], IdempotencyMiddleware);
//# sourceMappingURL=idempotency.middleware.js.map