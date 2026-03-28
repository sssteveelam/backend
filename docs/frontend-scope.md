# Frontend Scope (Based on existing backend APIs)

Tai lieu nay chi bao gom man hinh co the xay dung tu API da co.

## 1) Screen list theo role

### Chung (staff/manager/admin)

- Login
- Profile (`/me`)
- Dashboard tong quan (du lieu tong hop tu API hien co: inventory, near-expiry, approvals pending tuy role)
- Inventory
  - Inventory list
  - Near-expiry list
  - Batch list
  - Container detail (by QR)
  - Location inventory detail (by QR)
- Receipts
  - Tao receipt
  - Them line
  - Submit receipt
- Movements
  - Tao movement
  - Them line
  - Submit movement
- Reservations
  - Soft reserve
  - Hard lock/release/activity
- Issues & Picking
  - Tao issue
  - Plan picks
  - Soft reserve issue
  - Start picking
  - Confirm pick task
  - Complete/cancel issue
- Cycle count
  - Tao cycle count
  - Them line

### Manager + Admin

- Approvals list
- Approve/reject approval
- Master data create/update:
  - warehouse/location/supplier/product/product uom
- Submit cycle-count (manager+admin)

### Admin only

- Xoa warehouse/supplier/product
- Cancel receipt
- Admin adjustment (`POST /admin/adjustments`)
- Update config timeouts

## 2) Sitemap de xuat (co the doi path FE)

- `/login`
- `/app`
- `/app/profile`
- `/app/master-data/warehouses`
- `/app/master-data/locations`
- `/app/master-data/suppliers`
- `/app/master-data/products`
- `/app/inventory`
- `/app/inventory/near-expiry`
- `/app/batches`
- `/app/containers/:qrCode`
- `/app/locations/:qrCode`
- `/app/receipts`
- `/app/movements`
- `/app/reservations`
- `/app/issues`
- `/app/pick-tasks/:id`
- `/app/cycle-counts`
- `/app/approvals`
- `/app/admin/config-timeouts`
- `/app/admin/adjustments`

## 3) Navigation flow (high level)

1. Login -> role-based redirect:
  - staff -> inventory/issues/receipts focus
  - manager -> + approvals + master-data edit
  - admin -> full admin pages
2. Tu dashboard vao module theo tac vu.
3. Moi page private bat buoc auth guard.
4. Moi action quan trong co loading + error toast/inline.

## 4) Screen -> API mapping (ban rut gon)

- Login page:
  - `POST /auth/login`
  - sau do `GET /me` de verify session
- Header profile:
  - `GET /me`, `POST /auth/logout`
- Warehouses page:
  - `GET /warehouses`, `POST /warehouses`, `PATCH /warehouses/:id`, `DELETE /warehouses/:id`
- Products page:
  - `GET/POST/PATCH/DELETE /products`, `GET/POST /products/:id/uoms`
- Inventory page:
  - `GET /inventory`, `GET /inventory/near-expiry`, `GET /batches`
- Container/Location scan pages:
  - `GET /containers/:qr_code`, `POST /containers/:qr_code/open-seal`, `GET /locations/:qr_code`
- Receipts page:
  - `POST /receipts`, `POST /receipts/:id/lines`, `POST /receipts/:id/submit`, `POST /receipts/:id/cancel`
- Movements page:
  - `POST /movements`, `POST /movements/:id/lines`, `POST /movements/:id/submit`, `POST /admin/adjustments`
- Reservations page:
  - `POST /reservations/soft-reserve`, `POST /reservations/:id/hard-lock|release|activity`
- Issues page:
  - `POST /issues`, `POST /issues/:id/...`, `POST /pick-tasks/:id/confirm`
- Cycle count page:
  - `POST /cycle-counts`, `POST /cycle-counts/:id/lines`, `POST /cycle-counts/:id/submit`
- Approvals page:
  - `GET /approvals`, `POST /approvals/:id/approve|reject`
- Admin config page:
  - `GET/PUT /config/timeouts`

## 5) TODO

- Chua thay endpoint list/read cho receipts/movements/issues/cycle-counts (hien thay chu yeu create/action).  
=> FE can dung local state sau create, hoac can backend bo sung endpoint list/detail neu can man hinh tra cuu day du.

