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
exports.ContainerController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../../auth/guards/roles.guard");
const open_seal_dto_1 = require("../dto/open-seal.dto");
const inventory_query_service_1 = require("../services/inventory-query.service");
const container_seal_service_1 = require("../services/container-seal.service");
let ContainerController = class ContainerController {
    constructor(inventoryQueryService, containerSealService) {
        this.inventoryQueryService = inventoryQueryService;
        this.containerSealService = containerSealService;
    }
    viewContainer(req, qrCode) {
        return this.inventoryQueryService.viewContainerByQr(req.user.id, qrCode);
    }
    openSeal(req, qrCode, body) {
        return this.containerSealService.openSeal(req.user.id, qrCode, body);
    }
};
exports.ContainerController = ContainerController;
__decorate([
    (0, common_1.Get)(':qr_code'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('qr_code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ContainerController.prototype, "viewContainer", null);
__decorate([
    (0, common_1.Post)(':qr_code/open-seal'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('qr_code')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, open_seal_dto_1.OpenSealDto]),
    __metadata("design:returntype", void 0)
], ContainerController.prototype, "openSeal", null);
exports.ContainerController = ContainerController = __decorate([
    (0, common_1.Controller)('containers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [inventory_query_service_1.InventoryQueryService,
        container_seal_service_1.ContainerSealService])
], ContainerController);
//# sourceMappingURL=container.controller.js.map