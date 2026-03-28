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
exports.ReservationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const soft_reserve_dto_1 = require("./dto/soft-reserve.dto");
const update_activity_dto_1 = require("./dto/update-activity.dto");
const reservation_service_1 = require("./reservation.service");
let ReservationController = class ReservationController {
    constructor(reservationService) {
        this.reservationService = reservationService;
    }
    softReserve(req, body) {
        return this.reservationService.softReserve(req.user.id, body);
    }
    hardLock(req, reservationId) {
        return this.reservationService.hardLock(req.user.id, reservationId);
    }
    release(req, reservationId) {
        return this.reservationService.release(req.user.id, reservationId);
    }
    updateActivity(req, reservationId, body) {
        return this.reservationService.updateActivity(req.user.id, reservationId, body.action);
    }
};
exports.ReservationController = ReservationController;
__decorate([
    (0, common_1.Post)('soft-reserve'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, soft_reserve_dto_1.SoftReserveDto]),
    __metadata("design:returntype", void 0)
], ReservationController.prototype, "softReserve", null);
__decorate([
    (0, common_1.Post)(':id/hard-lock'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReservationController.prototype, "hardLock", null);
__decorate([
    (0, common_1.Post)(':id/release'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReservationController.prototype, "release", null);
__decorate([
    (0, common_1.Post)(':id/activity'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_activity_dto_1.UpdateActivityDto]),
    __metadata("design:returntype", void 0)
], ReservationController.prototype, "updateActivity", null);
exports.ReservationController = ReservationController = __decorate([
    (0, common_1.Controller)('reservations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [reservation_service_1.ReservationService])
], ReservationController);
//# sourceMappingURL=reservation.controller.js.map