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
exports.MovementController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const add_movement_line_dto_1 = require("./dto/add-movement-line.dto");
const admin_adjustment_dto_1 = require("./dto/admin-adjustment.dto");
const create_movement_dto_1 = require("./dto/create-movement.dto");
const submit_movement_dto_1 = require("./dto/submit-movement.dto");
const movement_service_1 = require("./movement.service");
const movement_list_query_dto_1 = require("./dto/movement-list-query.dto");
let MovementController = class MovementController {
    constructor(movementService) {
        this.movementService = movementService;
    }
    listMovements(query) {
        return this.movementService.listMovements(query);
    }
    getMovementDetail(movementId) {
        return this.movementService.getMovementDetail(movementId);
    }
    createMovement(req, body) {
        return this.movementService.createMovement(req.user.id, body);
    }
    addLine(req, movementId, body) {
        return this.movementService.addLine(req.user.id, movementId, body);
    }
    submitMovement(req, movementId, body) {
        const idempotencyKey = req.headers['idempotency-key'];
        return this.movementService.submitMovement(req.user.id, req.user.role, movementId, idempotencyKey ?? '', body);
    }
    adminAdjustment(req, body) {
        return this.movementService.adminAdjustment(req.user.id, req.user.role, body);
    }
};
exports.MovementController = MovementController;
__decorate([
    (0, common_1.Get)('movements'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [movement_list_query_dto_1.MovementListQueryDto]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "listMovements", null);
__decorate([
    (0, common_1.Get)('movements/:id'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "getMovementDetail", null);
__decorate([
    (0, common_1.Post)('movements'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_movement_dto_1.CreateMovementDto]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "createMovement", null);
__decorate([
    (0, common_1.Post)('movements/:id/lines'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_movement_line_dto_1.AddMovementLineDto]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "addLine", null);
__decorate([
    (0, common_1.Post)('movements/:id/submit'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, submit_movement_dto_1.SubmitMovementDto]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "submitMovement", null);
__decorate([
    (0, common_1.Post)('admin/adjustments'),
    (0, roles_guard_1.RequireRole)(['admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_adjustment_dto_1.AdminAdjustmentDto]),
    __metadata("design:returntype", void 0)
], MovementController.prototype, "adminAdjustment", null);
exports.MovementController = MovementController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [movement_service_1.MovementService])
], MovementController);
//# sourceMappingURL=movement.controller.js.map