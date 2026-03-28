export type PickTaskListItemDto = {
  id: string;
  issueLineId: string;
  productId: string;
  batchId: string;
  locationId: string;
  containerId: string | null;
  reservationId: string | null;
  quantityBase: string;
  pickedQuantity: string;
  status: string;
  createdAt: string;
};
