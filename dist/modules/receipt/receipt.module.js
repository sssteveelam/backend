"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const master_data_module_1 = require("../master-data/master-data.module");
const inventory_module_1 = require("../inventory/inventory.module");
const idempotency_module_1 = require("../idempotency/idempotency.module");
const approval_module_1 = require("../approval/approval.module");
const capacity_module_1 = require("../capacity/capacity.module");
const receipt_controller_1 = require("./receipt.controller");
const receipt_service_1 = require("./receipt.service");
const receipt_repository_1 = require("./receipt.repository");
let ReceiptModule = class ReceiptModule {
};
exports.ReceiptModule = ReceiptModule;
exports.ReceiptModule = ReceiptModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, master_data_module_1.MasterDataModule, inventory_module_1.InventoryModule, idempotency_module_1.IdempotencyModule, approval_module_1.ApprovalModule, capacity_module_1.CapacityModule],
        controllers: [receipt_controller_1.ReceiptController],
        providers: [receipt_service_1.ReceiptService, receipt_repository_1.ReceiptRepository],
    })
], ReceiptModule);
//# sourceMappingURL=receipt.module.js.map