"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const batch_repository_1 = require("./repositories/batch.repository");
const container_repository_1 = require("./repositories/container.repository");
const stock_line_repository_1 = require("./repositories/stock-line.repository");
const batch_service_1 = require("./services/batch.service");
const inventory_query_service_1 = require("./services/inventory-query.service");
const batch_controller_1 = require("./controllers/batch.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const container_controller_1 = require("./controllers/container.controller");
const location_inventory_controller_1 = require("./controllers/location-inventory.controller");
const master_data_module_1 = require("../master-data/master-data.module");
const prisma_module_1 = require("../prisma/prisma.module");
const approval_module_1 = require("../approval/approval.module");
const container_seal_service_1 = require("./services/container-seal.service");
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, master_data_module_1.MasterDataModule, prisma_module_1.PrismaModule, approval_module_1.ApprovalModule],
        controllers: [
            batch_controller_1.BatchController,
            inventory_controller_1.InventoryController,
            container_controller_1.ContainerController,
            location_inventory_controller_1.LocationInventoryController,
        ],
        providers: [
            batch_repository_1.BatchRepository,
            container_repository_1.ContainerRepository,
            stock_line_repository_1.StockLineRepository,
            batch_service_1.BatchService,
            inventory_query_service_1.InventoryQueryService,
            container_seal_service_1.ContainerSealService,
        ],
        exports: [batch_service_1.BatchService, inventory_query_service_1.InventoryQueryService],
    })
], InventoryModule);
//# sourceMappingURL=inventory.module.js.map