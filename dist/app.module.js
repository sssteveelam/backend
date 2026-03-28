"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./modules/auth/auth.module");
const prisma_module_1 = require("./modules/prisma/prisma.module");
const audit_module_1 = require("./modules/audit/audit.module");
const context_module_1 = require("./modules/context/context.module");
const idempotency_module_1 = require("./modules/idempotency/idempotency.module");
const context_middleware_1 = require("./middleware/context.middleware");
const idempotency_middleware_1 = require("./middleware/idempotency.middleware");
const master_data_module_1 = require("./modules/master-data/master-data.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const receipt_module_1 = require("./modules/receipt/receipt.module");
const movement_module_1 = require("./modules/movement/movement.module");
const approval_module_1 = require("./modules/approval/approval.module");
const reservation_module_1 = require("./modules/reservation/reservation.module");
const issue_module_1 = require("./modules/issue/issue.module");
const cycle_count_module_1 = require("./modules/cycle-count/cycle-count.module");
const app_controller_1 = require("./app.controller");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(context_middleware_1.ContextMiddleware).forRoutes('*');
        consumer.apply(idempotency_middleware_1.IdempotencyMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            context_module_1.ContextModule,
            audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            idempotency_module_1.IdempotencyModule,
            master_data_module_1.MasterDataModule,
            inventory_module_1.InventoryModule,
            receipt_module_1.ReceiptModule,
            movement_module_1.MovementModule,
            approval_module_1.ApprovalModule,
            reservation_module_1.ReservationModule,
            issue_module_1.IssueModule,
            cycle_count_module_1.CycleCountModule,
        ],
        controllers: [app_controller_1.AppController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map