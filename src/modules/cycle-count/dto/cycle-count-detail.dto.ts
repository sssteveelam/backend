import { CycleCountLineDto } from './cycle-count-line.dto';

export type CycleCountDetailDto = {
  id: string;
  code: string;
  status: string;
  locationId: string;
  createdBy: string;
  createdAt: string;
  lines: CycleCountLineDto[];
};

