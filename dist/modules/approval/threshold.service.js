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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThresholdService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const LINE_QUANTITY_PERCENT_THRESHOLD = 0.05;
const LINE_QUANTITY_UNITS_THRESHOLD = 5;
const DOC_VALUE_THRESHOLD = 2_000_000;
const DAILY_VALUE_THRESHOLD = 10_000_000;
let ThresholdService = class ThresholdService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async evaluate(input) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const submittedReceipts = await this.prisma.receipt.findMany({
            where: {
                createdBy: input.actorUserId,
                status: 'submitted',
                createdAt: { gte: startOfDay },
            },
            select: { totalValue: true },
        });
        const submittedMovements = await this.prisma.movement.findMany({
            where: {
                createdBy: input.actorUserId,
                status: 'submitted',
                createdAt: { gte: startOfDay },
            },
            include: {
                lines: {
                    include: {
                        batch: { select: { averageCost: true } },
                    },
                },
            },
        });
        const dailyReceiptValue = submittedReceipts.reduce((sum, r) => sum + Number(r.totalValue), 0);
        const dailyMovementValue = submittedMovements.reduce((sum, m) => {
            const value = m.lines.reduce((lineSum, line) => {
                const unitCost = Number(line.batch.averageCost ?? 0);
                return lineSum + Number(line.quantityBase) * unitCost;
            }, 0);
            return sum + value;
        }, 0);
        const dailyValueWithCurrent = dailyReceiptValue + dailyMovementValue;
        const lineEvaluations = input.lines.map((line) => {
            const baseline = line.baselineQuantityBase;
            const percentDelta = baseline && baseline > 0 ? Math.abs(line.quantityBase - baseline) / baseline : 0;
            const exceededByPercent = percentDelta > LINE_QUANTITY_PERCENT_THRESHOLD;
            const exceededByUnits = line.quantityBase > LINE_QUANTITY_UNITS_THRESHOLD;
            return {
                quantityBase: line.quantityBase,
                baselineQuantityBase: baseline ?? null,
                percentDelta,
                exceededByPercent,
                exceededByUnits,
                exceeded: exceededByPercent || exceededByUnits,
            };
        });
        const lineQuantityExceeded = lineEvaluations.some((l) => l.exceeded);
        const documentValueExceeded = input.documentValue > DOC_VALUE_THRESHOLD;
        const dailyValueExceeded = dailyValueWithCurrent > DAILY_VALUE_THRESHOLD;
        const requiresApproval = lineQuantityExceeded || documentValueExceeded || dailyValueExceeded;
        const snapshot = {
            line_quantity_threshold: {
                percent: LINE_QUANTITY_PERCENT_THRESHOLD,
                units: LINE_QUANTITY_UNITS_THRESHOLD,
            },
            doc_value_threshold: DOC_VALUE_THRESHOLD,
            daily_value_threshold: DAILY_VALUE_THRESHOLD,
            evaluated_result: {
                documentType: input.documentType,
                lineQuantityExceeded,
                documentValueExceeded,
                dailyValueExceeded,
                requiresApproval,
                poCodeRequired: requiresApproval,
                documentValue: input.documentValue,
                dailyValueWithCurrent,
                lineEvaluations,
            },
        };
        return { requiresApproval, snapshot };
    }
    async evaluateOpenSeal(input) {
        const quantityExceeded = input.totalQuantity > input.quantityThreshold;
        const valueExceeded = input.documentValue > input.valueThreshold;
        const requiresApproval = quantityExceeded || valueExceeded;
        const snapshot = {
            open_seal_threshold: {
                quantity: input.quantityThreshold,
                value: input.valueThreshold,
            },
            evaluated_result: {
                actorUserId: input.actorUserId,
                totalQuantity: input.totalQuantity,
                documentValue: input.documentValue,
                quantityExceeded,
                valueExceeded,
                requiresApproval,
                poCodeRequired: false,
            },
        };
        return { requiresApproval, snapshot };
    }
};
exports.ThresholdService = ThresholdService;
exports.ThresholdService = ThresholdService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ThresholdService);
//# sourceMappingURL=threshold.service.js.map