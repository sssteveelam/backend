import { Injectable } from '@nestjs/common';

export type CapacityCheckInput = {
  locationId: string;
  capacityLimit: number | null;
  incomingQuantity: number;
  currentStock: number;
};

export type CapacityCheckResult = {
  isOver: boolean;
  isBigOver: boolean;
  overPercentage: number;
  overAmount: number;
  warningMessage: string;
  newTotal: number;
};

const BIG_OVER_PERCENT_THRESHOLD = 10;
const BIG_OVER_BOX_THRESHOLD = 5;
const BIG_OVER_KG_THRESHOLD = 50;

@Injectable()
export class CapacityService {
  check(input: CapacityCheckInput): CapacityCheckResult {
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
    const isBigOver =
      isOver &&
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
}
