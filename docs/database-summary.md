# Database Summary (Prisma)

Nguon: `prisma/schema.prisma`.

## 1) User + Security

- `User`
  - field quan trong: `id`, `username`, `email`, `passwordHash`, `role`, `status`, `createdAt`
  - `role` enum: `staff | manager | admin`
- `AuditEvent`
  - luu audit action, actor, before/after json, correlation id
- `IdempotencyKey`
  - route + key + request hash + response json
  - frontend can biet de gui `Idempotency-Key` cho submit API

## 2) Master Data

- `Warehouse`: `id`, `code`, `name`
- `Location`: `warehouseId`, `code`, `name`, `capacityLimitBase`
- `Supplier`: `code`, `name`
- `Product`: `code`, `name`, `baseUom`
- `ProductUom`: map quy doi UOM (`factorToBase`) theo `product` + optional `supplier`

## 3) Inventory core

- `Batch`
  - product/supplier/manufacture/expiry/lotCode
- `Container`
  - `qrCode`, `locationId`, `isSealed`, `sealedAt`, `sealedBy`
- `StockLine`
  - ton theo tuple: `productId + batchId + locationId + containerId`
  - field chinh: `quantityBase`

## 4) Inbound / Internal movement / Outbound

- `Receipt` + `ReceiptLine`
  - trang thai receipt va line nhap kho
- `Movement` + `MovementLine`
  - dieu chuyen noi bo giua location
- `Issue` + `IssueLine` + `PickTask`
  - quy trinh xuat kho va pick task
- `Reservation`
  - dat cho ton kho (soft/hard lock), lien quan pick task

## 5) Counting + Approval + Config

- `CycleCount` + `CycleCountLine`
  - kiem ke theo location
- `ApprovalRequest`
  - phe duyet vuot nguong theo documentType/documentId
- `AppTimeoutConfig`
  - timeout global: `softReserveMinutes`, `hardLockMinutes`

## 6) Field uu tien cho frontend model/state

- User/session: `id`, `username`, `role`, `status`
- Lookup list: warehouse/location/supplier/product/uom
- Inventory grids: product, batch, location, container, quantity
- Document status:
  - receipt/movement/issue/cycle_count/reservation status
- Approval state:
  - pending/approved/rejected + reason + decidedBy/decidedAt

## 7) TODO

- Chua co migration docs de mo ta day du enum status cho tung document.
- Can bo sung dictionary status chuan (draft/submitted/cancelled/...) trong tai lieu business de FE map UI badge nhat quan.

