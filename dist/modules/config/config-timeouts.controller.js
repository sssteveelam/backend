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
exports.ConfigTimeoutsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const app_timeout_config_service_1 = require("./app-timeout-config.service");
const update_timeouts_dto_1 = require("./dto/update-timeouts.dto");
let ConfigTimeoutsController = class ConfigTimeoutsController {
    constructor(appTimeoutConfigService) {
        this.appTimeoutConfigService = appTimeoutConfigService;
    }
    getTimeouts() {
        return this.appTimeoutConfigService.getTimeouts();
    }
    putTimeouts(req, body) {
        return this.appTimeoutConfigService.updateTimeouts(body);
    }
};
exports.ConfigTimeoutsController = ConfigTimeoutsController;
__decorate([
    (0, common_1.Get)('timeouts'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ConfigTimeoutsController.prototype, "getTimeouts", null);
__decorate([
    (0, common_1.Put)('timeouts'),
    (0, roles_guard_1.RequireRole)(['admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_timeouts_dto_1.UpdateTimeoutsDto]),
    __metadata("design:returntype", void 0)
], ConfigTimeoutsController.prototype, "putTimeouts", null);
exports.ConfigTimeoutsController = ConfigTimeoutsController = __decorate([
    (0, common_1.Controller)('config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [app_timeout_config_service_1.AppTimeoutConfigService])
], ConfigTimeoutsController);
//# sourceMappingURL=config-timeouts.controller.js.map