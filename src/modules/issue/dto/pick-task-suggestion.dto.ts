import { IsUUID } from 'class-validator';

export class PickTaskSuggestionDto {
  pickTaskId!: string;
  scanSequenceRecommended!: string[]; // e.g. ["location", "container"]
  expected!: {
    locationId?: string;
    locationQrCode?: string;
    containerId?: string | null;
    containerQrCode?: string | null;
    batchId?: string;
    batchLotCode?: string;
    productId?: string;
  };
  hints!: {
    requiresContainerScan: boolean;
    requiresLocationScan: boolean;
    allowMissingContainer: boolean;
  };
}
