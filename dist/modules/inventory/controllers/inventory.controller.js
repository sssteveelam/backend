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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const inventory_query_service_1 = require("../services/inventory-query.service");
const inventory_suggestion_dto_1 = require("../dto/inventory-suggestion.dto");
let InventoryController = class InventoryController {
    constructor(inventoryQueryService) {
        this.inventoryQueryService = inventoryQueryService;
    }
    viewInventory(req, productId, locationId) {
        return this.inventoryQueryService.viewInventory(req.user.id, {
            productId,
            locationId,
        });
    }
    getSuggestions(req, query) {
        return this.inventoryQueryService.getSuggestions(req.user.id, query);
    }
    viewNearExpiry(req, days = '7') {
        const parsedDays = Number(days);
        return this.inventoryQueryService.viewNearExpiry(req.user.id, Number.isFinite(parsedDays) ? parsedDays : 7);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('product_id')),
    __param(2, (0, common_1.Query)('location_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "viewInventory", null);
__decorate([
    (0, common_1.Get)('suggestions'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inventory_suggestion_dto_1.InventorySuggestionQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getSuggestions", null);
__decorate([
    (0, common_1.Get)('near-expiry'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "viewNearExpiry", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('inventory'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [inventory_query_service_1.InventoryQueryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map