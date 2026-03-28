"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleCountModule = void 0;
const common_1 = require("@nestjs/common");
const approval_module_1 = require("../approval/approval.module");
const audit_module_1 = require("../audit/audit.module");
const movement_module_1 = require("../movement/movement.module");
const cycle_count_controller_1 = require("./cycle-count.controller");
const cycle_count_repository_1 = require("./cycle-count.repository");
const cycle_count_service_1 = require("./cycle-count.service");
let CycleCountModule = class CycleCountModule {
};
exports.CycleCountModule = CycleCountModule;
exports.CycleCountModule = CycleCountModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, movement_module_1.MovementModule, approval_module_1.ApprovalModule],
        controllers: [cycle_count_controller_1.CycleCountController],
        providers: [cycle_count_service_1.CycleCountService, cycle_count_repository_1.CycleCountRepository],
    })
], CycleCountModule);
//# sourceMappingURL=cycle-count.module.js.map