import { ReceiptLineDto } from './receipt-line.dto';

export type ReceiptDetailDto = {
  id: string;
  code: string;
  status: string;
  supplierId: string;
  warehouseId: string;
  totalValue: string;
  createdBy: string;
  createdAt: string;
  lines: ReceiptLineDto[];
};
