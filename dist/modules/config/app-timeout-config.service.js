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
var AppTimeoutConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppTimeoutConfigService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AppTimeoutConfigService = AppTimeoutConfigService_1 = class AppTimeoutConfigService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTimeouts() {
        let row = await this.prisma.appTimeoutConfig.findUnique({
            where: { id: AppTimeoutConfigService_1.DEFAULT_ID },
        });
        if (!row) {
            row = await this.prisma.appTimeoutConfig.create({
                data: {
                    id: AppTimeoutConfigService_1.DEFAULT_ID,
                    softReserveMinutes: AppTimeoutConfigService_1.DEFAULT_SOFT,
                    hardLockMinutes: AppTimeoutConfigService_1.DEFAULT_HARD,
                },
            });
        }
        return {
            softReserveMinutes: row.softReserveMinutes,
            hardLockMinutes: row.hardLockMinutes,
        };
    }
    async updateTimeouts(input) {
        const row = await this.prisma.appTimeoutConfig.upsert({
            where: { id: AppTimeoutConfigService_1.DEFAULT_ID },
            create: {
                id: AppTimeoutConfigService_1.DEFAULT_ID,
                softReserveMinutes: input.softReserveMinutes,
                hardLockMinutes: input.hardLockMinutes,
            },
            update: {
                softReserveMinutes: input.softReserveMinutes,
                hardLockMinutes: input.hardLockMinutes,
            },
        });
        return {
            softReserveMinutes: row.softReserveMinutes,
            hardLockMinutes: row.hardLockMinutes,
        };
    }
};
exports.AppTimeoutConfigService = AppTimeoutConfigService;
AppTimeoutConfigService.DEFAULT_ID = 'default';
AppTimeoutConfigService.DEFAULT_SOFT = 30;
AppTimeoutConfigService.DEFAULT_HARD = 60;
exports.AppTimeoutConfigService = AppTimeoutConfigService = AppTimeoutConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppTimeoutConfigService);
//# sourceMappingURL=app-timeout-config.service.js.map