export type MovementLineDto = {
  id: string;
  movementId: string;
  productId: string;
  batchId: string;
  containerId: string | null;
  quantityBase: string;
  createdAt: string;
};
