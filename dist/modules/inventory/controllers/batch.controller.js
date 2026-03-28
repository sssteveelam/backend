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
exports.BatchController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const batch_service_1 = require("../services/batch.service");
let BatchController = class BatchController {
    constructor(batchService) {
        this.batchService = batchService;
    }
    viewBatches(req, productId, nearExpiryDays) {
        const days = nearExpiryDays ? Number(nearExpiryDays) : undefined;
        return this.batchService.viewBatches(req.user.id, {
            productId,
            nearExpiryDays: Number.isFinite(days) ? days : undefined,
        });
    }
};
exports.BatchController = BatchController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('product_id')),
    __param(2, (0, common_1.Query)('near_expiry_days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], BatchController.prototype, "viewBatches", null);
exports.BatchController = BatchController = __decorate([
    (0, common_1.Controller)('batches'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [batch_service_1.BatchService])
], BatchController);
//# sourceMappingURL=batch.controller.js.map