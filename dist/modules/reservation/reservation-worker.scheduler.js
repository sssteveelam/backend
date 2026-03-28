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
var ReservationWorkerScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationWorkerScheduler = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const reservation_timeout_service_1 = require("./reservation-timeout.service");
let ReservationWorkerScheduler = ReservationWorkerScheduler_1 = class ReservationWorkerScheduler {
    constructor(reservationTimeoutService, configService) {
        this.reservationTimeoutService = reservationTimeoutService;
        this.configService = configService;
        this.logger = new common_1.Logger(ReservationWorkerScheduler_1.name);
        this.intervalHandle = null;
    }
    onModuleInit() {
        const enabled = this.configService.get('RESERVATION_WORKER_ENABLED', 'true');
        if (enabled === 'false' || enabled === '0') {
            this.logger.log('Reservation worker disabled (RESERVATION_WORKER_ENABLED=false)');
            return;
        }
        const raw = this.configService.get('RESERVATION_AUTO_RELEASE_INTERVAL_MS', '60000');
        const intervalMs = Math.max(5000, parseInt(raw, 10) || 60_000);
        this.intervalHandle = setInterval(() => {
            void this.reservationTimeoutService.runAutoReleaseCycle().catch((err) => {
                this.logger.error(`Scheduled reservation auto-release error: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
            });
        }, intervalMs);
        this.logger.log(`Reservation worker scheduled every ${intervalMs}ms`);
    }
    onModuleDestroy() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
};
exports.ReservationWorkerScheduler = ReservationWorkerScheduler;
exports.ReservationWorkerScheduler = ReservationWorkerScheduler = ReservationWorkerScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reservation_timeout_service_1.ReservationTimeoutService,
        config_1.ConfigService])
], ReservationWorkerScheduler);
//# sourceMappingURL=reservation-worker.scheduler.js.map