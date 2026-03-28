"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const idempotency_module_1 = require("../idempotency/idempotency.module");
const approval_module_1 = require("../approval/approval.module");
const capacity_module_1 = require("../capacity/capacity.module");
const movement_controller_1 = require("./movement.controller");
const movement_service_1 = require("./movement.service");
const movement_repository_1 = require("./movement.repository");
const adjustment_service_1 = require("./adjustment.service");
let MovementModule = class MovementModule {
};
exports.MovementModule = MovementModule;
exports.MovementModule = MovementModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, idempotency_module_1.IdempotencyModule, approval_module_1.ApprovalModule, capacity_module_1.CapacityModule],
        controllers: [movement_controller_1.MovementController],
        providers: [movement_service_1.MovementService, movement_repository_1.MovementRepository, adjustment_service_1.AdjustmentService],
        exports: [adjustment_service_1.AdjustmentService],
    })
], MovementModule);
//# sourceMappingURL=movement.module.js.map