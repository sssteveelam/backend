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
exports.ContextMiddleware = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const context_service_1 = require("../modules/context/context.service");
let ContextMiddleware = class ContextMiddleware {
    constructor(contextService) {
        this.contextService = contextService;
    }
    use(req, _res, next) {
        const correlationIdHeader = req.header('x-correlation-id');
        const correlationId = correlationIdHeader?.trim() || (0, crypto_1.randomUUID)();
        this.contextService.run({
            correlationId,
            actorUserId: null,
        }, () => {
            next();
        });
    }
};
exports.ContextMiddleware = ContextMiddleware;
exports.ContextMiddleware = ContextMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_service_1.ContextService])
], ContextMiddleware);
//# sourceMappingURL=context.middleware.js.map