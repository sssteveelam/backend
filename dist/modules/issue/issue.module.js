"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const config_module_1 = require("../config/config.module");
const reservation_module_1 = require("../reservation/reservation.module");
const issue_controller_1 = require("./issue.controller");
const issue_repository_1 = require("./issue.repository");
const issue_service_1 = require("./issue.service");
const picking_service_1 = require("./picking.service");
let IssueModule = class IssueModule {
};
exports.IssueModule = IssueModule;
exports.IssueModule = IssueModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, reservation_module_1.ReservationModule, config_module_1.AppConfigModule],
        controllers: [issue_controller_1.IssueController],
        providers: [issue_repository_1.IssueRepository, issue_service_1.IssueService, picking_service_1.PickingService],
    })
], IssueModule);
//# sourceMappingURL=issue.module.js.map