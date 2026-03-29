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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const ai_query_dto_1 = require("./dto/ai-query.dto");
const roles_guard_1 = require("../auth/guards/roles.guard");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const cache_manager_1 = require("@nestjs/cache-manager");
let AiController = class AiController {
    constructor(aiService) {
        this.aiService = aiService;
    }
    async getAiReport(userId, dto) {
        dto.feature = 'REPORT';
        return this.aiService.processAiRequest(userId, dto);
    }
    async getAiExpiryRisk(userId, dto) {
        dto.feature = 'EXPIRY_RISK';
        return this.aiService.processAiRequest(userId, dto);
    }
    async getAiForecast(userId, dto) {
        dto.feature = 'FORECAST';
        return this.aiService.processAiRequest(userId, dto);
    }
    async getAiHistory(userId, limit) {
        return this.aiService.getHistory(userId, limit ? Number(limit) : 20);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('report'),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    (0, cache_manager_1.CacheTTL)(1800),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ai_query_dto_1.AiQueryDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getAiReport", null);
__decorate([
    (0, common_1.Post)('expiry-risk'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    (0, cache_manager_1.CacheTTL)(600),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ai_query_dto_1.AiQueryDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getAiExpiryRisk", null);
__decorate([
    (0, common_1.Post)('forecast'),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor),
    (0, cache_manager_1.CacheTTL)(3600),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ai_query_dto_1.AiQueryDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getAiForecast", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, get_user_decorator_1.GetUser)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getAiHistory", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map