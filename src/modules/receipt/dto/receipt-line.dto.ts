export type ReceiptLineDto = {
  id: string;
  receiptId: string;
  productId: string;
  supplierId: string | null;
  batchId: string | null;
  quantity: string;
  quantityBase: string | null;
  uom: string;
  unitCost: string;
  manufactureDate: string;
  expiryDate: string;
  lotCode: string;
  containerQrCode: string | null;
  createdAt: string;
};
