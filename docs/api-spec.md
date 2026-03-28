# API Spec (Extracted from code)

Tai lieu nay chi ghi nhan API tim thay trong controller/service/DTO hien co. Khong suy doan endpoint khong ton tai.

## Error envelope chung

Moi loi HTTP qua `HttpExceptionFilter`:

```json
{
  "error": {
    "code": "BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|HTTP_ERROR|INTERNAL_SERVER_ERROR",
    "message": "..."
  }
}
```

## Auth

### POST `/auth/login`
- Auth: Khong
- Body (`LoginDto`):
  - `usernameOrEmail`: string, required, not empty
  - `password`: string, required, minLength 6
- Success 200:
  - `{ accessToken: string, user: { id, username, role } }`
- Errors thay ro:
  - `401 UNAUTHORIZED`: `Sai username/email hoặc mật khẩu`
- FE hint:
  - loading button
  - voi 401: hien inline error duoi nut submit

### POST `/auth/logout`
- Auth: Co (`Bearer` token)
- Body: khong
- Success:
  - `{ ok: true }`
- FE hint:
  - call API roi clear local auth state/token

### GET `/me`
- Auth: Co (`Bearer` token), role `staff|manager|admin`
- Success:
  - `{ id, username, role }`
- Errors thay ro:
  - `401 UNAUTHORIZED`: `Token không hợp lệ`
  - `403 FORBIDDEN`: `Không có quyền truy cập`

## Master Data

### Warehouses (`/warehouses`)
- `POST /warehouses` (manager, admin)
  - Body: `code` (string, max 50), `name` (string, max 255)
- `GET /warehouses` (staff, manager, admin)
- `GET /warehouses/:id` (staff, manager, admin)
- `PATCH /warehouses/:id` (manager, admin)
  - Body optional: `code`, `name`
- `DELETE /warehouses/:id` (admin)
- Errors thuong gap (service):
  - `409`: `Warehouse code đã tồn tại`
  - `404`: `Warehouse không tồn tại`

### Locations
- `POST /locations` (manager, admin)
  - Body: `warehouseId` uuid, `code`, `name`, `capacityLimitBase? >= 0`
- `GET /warehouses/:id/locations` (staff, manager, admin)
- Errors:
  - `404`: `Warehouse không tồn tại`
  - `409`: `Location code đã tồn tại trong warehouse`

### Suppliers (`/suppliers`)
- `POST /suppliers` (manager, admin): body `code`, `name`
- `GET /suppliers` (staff, manager, admin)
- `GET /suppliers/:id` (staff, manager, admin)
- `PATCH /suppliers/:id` (manager, admin): body optional `code`, `name`
- `DELETE /suppliers/:id` (admin)
- Errors:
  - `409`: `Supplier code đã tồn tại`
  - `404`: `Supplier không tồn tại`

### Products (`/products`)
- `POST /products` (manager, admin): body `code`, `name`, `baseUom`
- `GET /products` (staff, manager, admin)
- `GET /products/:id` (staff, manager, admin)
- `PATCH /products/:id` (manager, admin): body optional `code`, `name`, `baseUom`
- `DELETE /products/:id` (admin)
- `GET /products/:id/uoms` (staff, manager, admin)
- `POST /products/:id/uoms` (manager, admin)
  - body: `supplierId?` uuid, `uom` string max 50, `factorToBase` number > 0
- Errors:
  - `409`: `Product code đã tồn tại`, `Product UoM đã tồn tại...`
  - `404`: `Product không tồn tại`, `Supplier không tồn tại`

## Inventory

### GET `/inventory`
- Auth: staff|manager|admin
- Query:
  - `product_id?`
  - `location_id?`

### GET `/inventory/near-expiry`
- Auth: staff|manager|admin
- Query:
  - `days?` (default 7)

### GET `/batches`
- Auth: staff|manager|admin
- Query:
  - `product_id?`
  - `near_expiry_days?`

### GET `/containers/:qr_code`
- Auth: staff|manager|admin
- Errors:
  - `404`: `Container không tồn tại`

### POST `/containers/:qr_code/open-seal`
- Auth: staff|manager|admin
- Body (`OpenSealDto`):
  - `reason`: string, required
  - `context`: `'issue' | 'warehouse_op'`
- Errors:
  - `400`: `reason là bắt buộc`
  - `404`: `Container không tồn tại`
  - `409`: `CONTAINER_ALREADY_OPEN`

### GET `/locations/:qr_code`
- Auth: staff|manager|admin
- Errors:
  - `404`: `Location không tồn tại`

## Receipt

### GET `/receipts`
- Auth: staff|manager|admin
- Query (`ReceiptListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `status?`: `draft|submitted|cancelled`
  - `code?`: string, partial match (contains, case-insensitive)
  - `supplierId?`: uuid
  - `warehouseId?`: uuid
  - `createdFrom?`: ISO datetime
  - `createdTo?`: ISO datetime
- Sort: `createdAt desc`
- Response: `ListResponse<ReceiptListItemDto>`
  - `data[]`: `{ id, code, status, supplierId, warehouseId, totalValue, createdBy, createdAt }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `400`: invalid pagination/filter, date range invalid (`createdFrom` > `createdTo`)

### GET `/receipts/:id`
- Auth: staff|manager|admin
- Response: `ReceiptDetailDto`
  - header: `{ id, code, status, supplierId, warehouseId, totalValue, createdBy, createdAt }`
  - `lines[]`: `{ id, receiptId, productId, supplierId, batchId, quantity, quantityBase, uom, unitCost, manufactureDate, expiryDate, lotCode, containerQrCode, createdAt }`
- Errors:
  - `404`: `Receipt không tồn tại`

### POST `/receipts`
- Auth: staff|manager|admin
- Body (`CreateReceiptDto`):
  - `code` string
  - `supplierId` uuid
  - `warehouseId` uuid
- Errors:
  - `404`: `Supplier không tồn tại`, `Warehouse không tồn tại`
  - `409`: `Receipt code đã tồn tại`

### POST `/receipts/:id/lines`
- Auth: staff|manager|admin
- Body (`AddReceiptLineDto`):
  - `productId` uuid
  - `supplierId?` uuid
  - `quantity` > 0
  - `uom` string
  - `unitCost` >= 0
  - `manufactureDate`, `expiryDate` (ISO date)
  - `lotCode` string
  - `containerQrCode?` string
- Errors:
  - `400`: quantity/unitCost/date invalid
  - `403`: chi cho add line khi draft
  - `404`: receipt/product/supplier khong ton tai

### POST `/receipts/:id/submit`
- Auth: staff|manager|admin
- Header:
  - `Idempotency-Key` bat buoc
- Body (`SubmitReceiptDto`):
  - `overrideCapacity?` boolean
  - `overrideReason?` string (required trong mot so truong hop)
- Errors:
  - `400`: thieu idempotency key, receipt chua co line, ...
  - `403`: `BIG_OVER_REQUIRES_APPROVAL`, khong co quyen
  - `409`: idempotency key reuse khac payload, receipt da submit/cancelled

### POST `/receipts/:id/cancel`
- Auth: admin
- Errors:
  - `404`: receipt khong ton tai
  - `400`: chi duoc cancel receipt draft

## Movement

### GET `/movements`
- Auth: staff|manager|admin
- Query (`MovementListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `status?`: `draft|submitted`
  - `code?`: string, partial match (contains, case-insensitive)
  - `fromLocationId?`: uuid
  - `toLocationId?`: uuid
  - `createdFrom?`: ISO datetime
  - `createdTo?`: ISO datetime
- Sort: `createdAt desc`
- Response: `ListResponse<MovementListItemDto>`
  - `data[]`: `{ id, code, status, fromLocationId, toLocationId, createdBy, createdAt }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `400`: invalid pagination/filter, date range invalid (`createdFrom` > `createdTo`)

### GET `/movements/:id`
- Auth: staff|manager|admin
- Response: `MovementDetailDto`
  - header: `{ id, code, status, fromLocationId, toLocationId, createdBy, createdAt }`
  - `lines[]`: `{ id, movementId, productId, batchId, containerId, quantityBase, createdAt }`
- Errors:
  - `404`: `Movement không tồn tại`

### POST `/movements`
- Auth: staff|manager|admin
- Body (`CreateMovementDto`):
  - `code` string
  - `fromLocationId` uuid
  - `toLocationId` uuid
- Errors:
  - `400`: from/to trung nhau
  - `404`: location khong ton tai
  - `409`: movement code da ton tai

### POST `/movements/:id/lines`
- Auth: staff|manager|admin
- Body (`AddMovementLineDto`):
  - `productId` uuid
  - `batchId` uuid
  - `containerId?` uuid
  - `quantityBase` > 0
- Errors:
  - `403`: chi them line khi draft
  - `404`: movement/product/batch/container khong ton tai

### POST `/movements/:id/submit`
- Auth: staff|manager|admin
- Header:
  - `Idempotency-Key` bat buoc
- Body (`SubmitMovementDto`):
  - `scanSequence`: array item in `container|location`
  - `scannedContainerId`, `scannedContainerQr`
  - `scannedLocationId`, `scannedLocationQr`
  - `overrideCapacity?`, `overrideReason?`
- Errors:
  - `400`: `INVALID_SCAN_ORDER`, thieu key, ...
  - `403`: `BIG_OVER_REQUIRES_APPROVAL` hoac khong co quyen
  - `404`: movement/location khong ton tai
  - `409`: movement da submit, idempotency conflict

### POST `/admin/adjustments`
- Auth: admin
- Body (`AdminAdjustmentDto`):
  - `productId`, `batchId`, `locationId`, `containerId?`
  - `newQuantityBase` >= 0
  - `reason` required
- Errors:
  - `403`: chi admin
  - `404`: product/batch/location/container khong ton tai
  - `400`: khong cho phep am ton

## Reservation

### POST `/reservations/soft-reserve`
- Auth: staff|manager|admin
- Body (`SoftReserveDto`):
  - `productId`, `batchId`, `locationId`, `containerId?` (uuid)
  - `quantityBase` > 0
  - `ttlSeconds` >= 1
- Errors:
  - `400`: quantity invalid, container mismatch location
  - `404`: product/batch/location/container not found
  - `409`: `RESERVATION_EXCEEDS_AVAILABLE`

### POST `/reservations/:id/hard-lock`
### POST `/reservations/:id/release`
### POST `/reservations/:id/activity`
- Auth: staff|manager|admin
- `:id/activity` body: `{ action: string }`
- Errors:
  - `404`: reservation khong ton tai
  - `409`: invalid state / expired / already released

## Issue + Picking

### GET `/issues`
- Auth: staff|manager|admin
- Query (`IssueListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `status?`: `draft|planned|picking|completed|cancelled`
  - `code?`: string, partial match (contains, case-insensitive)
  - `createdFrom?`: ISO datetime
  - `createdTo?`: ISO datetime
- Sort: `createdAt desc`
- Response: `ListResponse<IssueListItemDto>`
  - `data[]`: `{ id, code, status, createdBy, createdAt }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `400`: invalid pagination/filter, date range invalid (`createdFrom` > `createdTo`)

### GET `/issues/:id`
- Auth: staff|manager|admin
- Response: `IssueDetailDto`
  - header: `{ id, code, status, createdBy, createdAt }`
  - `lines[]`: `{ id, issueId, productId, quantityBase, createdAt }`
- Errors:
  - `404`: `Issue không tồn tại`

### GET `/issues/:id/pick-tasks`
- Auth: staff|manager|admin
- Query (`PickTaskListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `status?`: `pending|done|cancelled`
- Response: `ListResponse<PickTaskListItemDto>`
  - `data[]`: `{ id, issueLineId, productId, batchId, locationId, containerId, reservationId, quantityBase, pickedQuantity, status, createdAt }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `404`: `Issue không tồn tại`

### POST `/issues`
- Auth: staff|manager|admin
- Body (`CreateIssueDto`):
  - `code` string
  - `lines[]`: `{ productId: uuid, quantityBase > 0 }`

### POST `/issues/:id/plan-picks`
- Body (`PlanPicksDto`) optional overrides[]

### POST `/issues/:id/soft-reserve`
### POST `/issues/:id/start-picking`
### POST `/issues/:id/complete`
### POST `/issues/:id/cancel`

### POST `/pick-tasks/:id/confirm`
- Body (`ConfirmPickDto`):
  - `scanSequence` string[]
  - `scannedLocationQr` string
  - `scannedContainerQr?` string
  - `pickedQuantity` >= 0.000001

```
- Errors (service):
  - `400`: `INVALID_SCAN_ORDER`, issue/pick data invalid
  - `404`: issue/pick task not found
  - `409`: state conflict, not enough stock, reservation conflict, ...

### Inventory suggestions
- **Endpoint**: `GET /inventory/suggestions`
- **PROPOSED NEW API**
- **Auth**: `staff`, `manager`, `admin`
- **Query**:
  - `productId`: UUID (Required)
  - `quantityBase`: Decimal string (Optional)
  - `warehouseId`: UUID (Optional)
  - `locationId`: UUID (Optional)
  - `nearExpiryDays`: Integer (Optional)
  - `limit`: Integer (Default 10, Max 50)
- **Response**: `InventorySuggestionResponseDto`
  ```json
  {
    "productId": "uuid",
    "basis": "FEFO",
    "suggestions": [
      {
        "rank": 1,
        "locationId": "uuid",
        "locationCode": "A-01-01",
        "containerId": "uuid | null",
        "containerQrCode": "C-123 | null",
        "batchId": "uuid",
        "batchLotCode": "LOT-001",
        "expiryDate": "2024-12-01T00:00:00Z",
        "availableQuantityBase": "100.00",
        "uomHint": "KG",
        "reason": "FEFO earliest expiry, Sufficient quantity"
      }
    ]
  }
  ```

### Pick-task suggestions
- **Endpoint**: `GET /pick-tasks/:id/suggestions`
- **PROPOSED NEW API**
- **Auth**: `staff`, `manager`, `admin`
- **Response**: `PickTaskSuggestionDto`
  ```json
  {
    "pickTaskId": "uuid",
    "scanSequenceRecommended": ["location", "container"],
    "expected": {
      "locationId": "uuid",
      "locationQrCode": "LOC-01",
      "containerId": "uuid | null",
      "containerQrCode": "C-01 | null",
      "batchId": "uuid",
      "batchLotCode": "LOT-01",
      "productId": "uuid"
    },
    "hints": {
      "requiresContainerScan": true,
      "requiresLocationScan": true,
      "allowMissingContainer": false
    }
  }
  ```

## Cycle Count

### GET `/cycle-counts`
- Auth: staff|manager|admin
- Query (`CycleCountListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `status?`: `draft|submitted`
  - `code?`: string, partial match (contains, case-insensitive)
  - `locationId?`: uuid
  - `createdFrom?`: ISO datetime
  - `createdTo?`: ISO datetime
- Sort: `createdAt desc`
- Response: `ListResponse<CycleCountListItemDto>`
  - `data[]`: `{ id, code, status, locationId, createdBy, createdAt }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `400`: invalid pagination/filter, date range invalid (`createdFrom` > `createdTo`)

### POST `/cycle-counts`
- Auth: staff|manager|admin
- Body (`CreateCycleCountDto`):
  - `code` string
  - `locationId` uuid

### GET `/cycle-counts/:id`
- Auth: staff|manager|admin
- Response: `CycleCountDetailDto`
  - `header`: `{ id, code, status, locationId, createdBy, createdAt }`
  - `lines[]`: `{ id, cycleCountId, productId, batchId, containerId, countedQuantity, createdAt }`
- Errors:
  - `404`: `Cycle count không tồn tại`

### POST `/cycle-counts/:id/lines`
- Body (`AddCycleCountLineDto`):
  - `productId`, `batchId`, `containerId?`
  - `countedQuantity` >= 0
  - `scanSequence?` (`location|container`)
  - `scannedLocationId?`, `scannedContainerId?`

### POST `/cycle-counts/:id/submit`
- Auth: manager|admin
- Body (`SubmitCycleCountDto`): `reason?`

## Approval

### GET `/approvals`
- Auth: manager|admin
- Query: `status?`

### POST `/approvals/:id/approve`
- Auth: manager|admin
- Body (`ApproveApprovalDto`): `poCode?`

### POST `/approvals/:id/reject`
- Auth: manager|admin
- Body (`RejectApprovalDto`): `reason` required

- Errors thuong gap:
  - `404`: approval/document lien quan khong ton tai
  - `409`: approval khong o `pending`
  - `400`: `PO_CODE_REQUIRED` trong mot so truong hop

## Config

### GET `/config/timeouts`
- Auth: staff|manager|admin
- Tra timeout config

### PUT `/config/timeouts`
- Auth: admin
- Body (`UpdateTimeoutsDto`):
  - `softReserveMinutes`: int 1..43200
  - `hardLockMinutes`: int 1..43200

## Audit

### GET `/audit`
- Auth: admin
- Query (`AuditListQueryDto`):
  - `page?`: int >= 1 (default 1)
  - `limit?`: int 1..200 (default 20)
  - `entityType?`: string (gợi ý: `receipt|movement|issue|cycle_count|reservation|container|location|product...`)
  - `entityId?`: uuid
  - `actorUserId?`: uuid
  - `action?`: string
  - `createdFrom?`: ISO datetime
  - `createdTo?`: ISO datetime
- Sort: `createdAt desc`
- Response: `ListResponse<AuditLogItemDto>`
  - `data[]`: `{ id, entityType, entityId, action, actorUserId, createdAt, reason?, before?, after? }`
  - `meta`: `{ page, limit, total, totalPages }`
- Errors:
  - `400`: invalid pagination/filter, date range invalid (`createdFrom` > `createdTo`)

## TODO can bo sung de FE type-safe hon

- Chua co OpenAPI/Swagger de chot schema response cho tat ca endpoint.
- Nhieu endpoint khong co DTO response rieng, can doc them service/repository neu muon map chi tiet tung field.
