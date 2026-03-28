import { MovementLineDto } from './movement-line.dto';

export type MovementDetailDto = {
  id: string;
  code: string;
  status: string;
  fromLocationId: string;
  toLocationId: string;
  createdBy: string;
  createdAt: string;
  lines: MovementLineDto[];
};
