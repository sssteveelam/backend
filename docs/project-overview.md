# Project Overview

## 1) Muc tieu he thong

Backend hien tai la WMS MVP (quan ly kho), cung cap API cho cac quy trinh:

- Quan ly danh muc (warehouse/location/supplier/product/uom)
- Theo doi ton kho, batch, container, near-expiry
- Nhap kho (`receipts`) va dieu chuyen kho (`movements`)
- Dat cho ton (`reservations`) va xuat kho (`issues`, `pick_tasks`)
- Kiem ke (`cycle_counts`)
- Phe duyet vuot nguong (`approvals`)
- Xac thuc nguoi dung bang JWT (`auth`)

Cong nghe chinh: NestJS + Prisma + PostgreSQL.

## 2) Doi tuong su dung va role

Role duoc dinh nghia trong DB enum `UserRole`:

- `staff`
- `manager`
- `admin`

Role duoc gan vao JWT payload (`sub`, `username`, `role`) va duoc check boi `JwtAuthGuard` + `RolesGuard`.

## 3) AuthN/AuthZ va convention API

- Dang nhap: `POST /auth/login`, tra ve `accessToken` + `user`.
- Cac API private dung header:
  - `Authorization: Bearer <accessToken>`
- Mot so API submit co idempotency:
  - `Idempotency-Key` (bat buoc cho submit receipt/movement theo service logic)
- Error format global:
  - `{ "error": { "code": "...", "message": "..." } }`
  - Mapping code chinh: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`.

## 4) Module hien co trong backend

Theo `AppModule`:

- `AuthModule`
- `PrismaModule`
- `AuditModule`
- `ContextModule`
- `IdempotencyModule`
- `MasterDataModule`
- `InventoryModule`
- `ReceiptModule`
- `MovementModule`
- `ApprovalModule`
- `ReservationModule`
- `IssueModule`
- `CycleCountModule`

## 5) Luong nghiep vu tong quan (high-level)

1. User login -> nhan JWT.
2. Quan ly master data (warehouse/location/product/supplier/uom).
3. Tao receipt/movement/issue/cycle-count o trang thai draft.
4. Them line, scan/validate, submit.
5. Neu vuot nguong capacity -> tao approval request, manager/admin approve/reject.
6. Reservation + pick tasks + complete issue cap nhat ton kho.

## 6) Note cho frontend

- Backend hien chi co access token response body, chua thay endpoint refresh token.
- `POST /auth/logout` chi log audit va tra `{ ok: true }`, khong thay revoke token server-side.
- `GET /me` da bao ve boi JWT + role guard (`staff|manager|admin`).
- CORS hien mo cho `http://localhost:5173` va `credentials: true`.

## 7) TODO/unknown

- Khong tim thay `README.md` trong root backend de bo sung business context.
- Chua co Swagger/OpenAPI file trong source.
- Can bo sung tai lieu API response chi tiet hon neu muon typed FE 100% (mot so endpoint dang tra truc tiep object tu service, khong khai bao DTO response rieng).

