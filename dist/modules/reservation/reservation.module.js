"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const config_module_1 = require("../config/config.module");
const reservation_controller_1 = require("./reservation.controller");
const reservation_repository_1 = require("./reservation.repository");
const reservation_service_1 = require("./reservation.service");
const reservation_timeout_service_1 = require("./reservation-timeout.service");
const reservation_worker_scheduler_1 = require("./reservation-worker.scheduler");
let ReservationModule = class ReservationModule {
};
exports.ReservationModule = ReservationModule;
exports.ReservationModule = ReservationModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, config_module_1.AppConfigModule],
        controllers: [reservation_controller_1.ReservationController],
        providers: [
            reservation_service_1.ReservationService,
            reservation_repository_1.ReservationRepository,
            reservation_timeout_service_1.ReservationTimeoutService,
            reservation_worker_scheduler_1.ReservationWorkerScheduler,
        ],
        exports: [reservation_service_1.ReservationService, reservation_timeout_service_1.ReservationTimeoutService],
    })
], ReservationModule);
//# sourceMappingURL=reservation.module.js.map