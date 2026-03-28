"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityService = void 0;
const common_1 = require("@nestjs/common");
const BIG_OVER_PERCENT_THRESHOLD = 10;
const BIG_OVER_BOX_THRESHOLD = 5;
const BIG_OVER_KG_THRESHOLD = 50;
let CapacityService = class CapacityService {
    check(input) {
        const newTotal = input.currentStock + input.incomingQuantity;
        const capacity = input.capacityLimit ?? 0;
        if (capacity <= 0) {
            return {
                isOver: false,
                isBigOver: false,
                overPercentage: 0,
                overAmount: 0,
                warningMessage: '',
                newTotal,
            };
        }
        const overAmount = Math.max(newTotal - capacity, 0);
        const isOver = overAmount > 0;
        const overPercentage = isOver ? (overAmount / capacity) * 100 : 0;
        const isBigOver = isOver &&
            (overPercentage > BIG_OVER_PERCENT_THRESHOLD ||
                overAmount > BIG_OVER_BOX_THRESHOLD ||
                overAmount > BIG_OVER_KG_THRESHOLD);
        const warningMessage = isOver
            ? `Location capacity exceeded by ${overAmount.toFixed(6)} (${overPercentage.toFixed(2)}%).`
            : '';
        return {
            isOver,
            isBigOver,
            overPercentage,
            overAmount,
            warningMessage,
            newTotal,
        };
    }
};
exports.CapacityService = CapacityService;
exports.CapacityService = CapacityService = __decorate([
    (0, common_1.Injectable)()
], CapacityService);
//# sourceMappingURL=capacity.service.js.map