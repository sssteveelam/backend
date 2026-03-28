# Frontend Rules (Next.js + TypeScript)

## 1) Tech stack va architecture

- Framework: Next.js (App Router) + React + TypeScript.
- Tach lop ro rang:
  - `src/services/api/*`: thu vien goi API
  - `src/hooks/*`: business logic + state query/mutation
  - `src/components/*`: UI component tai su dung
  - `src/app/*`: route pages/layouts
- Khong goi `fetch/axios` truc tiep trong component page neu da co service.

## 2) Auth/token strategy (fit backend hien tai)

- Backend tra `accessToken` tu `POST /auth/login`; chua thay refresh endpoint.
- Rule tam thoi:
  - Luu access token trong memory + fallback `sessionStorage` (neu can persist tab)
  - Day token vao header `Authorization: Bearer ...` cho private APIs
  - Logout: goi `POST /auth/logout` roi xoa auth state local
- TODO:
  - Neu backend bo sung cookie httpOnly/refresh token, uu tien chuyen sang cookie-based session.

## 3) Guard va role-based access

- `AuthGuard`: chua login -> redirect `/login`.
- `RoleGuard`: check role tu `GET /me`; khong du quyen -> page 403.
- Role source of truth la field `user.role` tu backend (`staff|manager|admin`).

## 4) Validation va form behavior

- Form schema bat buoc bam theo DTO backend:
  - login: `usernameOrEmail` required, `password` min 6
  - create/update module theo validator trong `api-spec.md`
- Validation hien thi:
  - field-level inline errors (truoc submit)
  - submit errors: inline o khu vuc action + toast neu loi he thong

## 5) Standard UI states

Moi screen co du 4 state:

- `loading`: skeleton/spinner
- `error`: message + retry
- `empty`: trang thai rong co CTA ro rang
- `success`: data table/card/form state

## 6) API error handling

- Parse envelope:
  - `error.code`
  - `error.message`
- Mapping UX:
  - `UNAUTHORIZED` -> quay ve login / thong bao het phien
  - `FORBIDDEN` -> 403 page
  - `BAD_REQUEST` -> inline field/form errors neu map duoc
  - `CONFLICT` -> toast/inline theo ngu canh
  - `NOT_FOUND` -> empty/not found view

## 7) Idempotency rule

- Bat buoc gui `Idempotency-Key` cho:
  - `POST /receipts/:id/submit`
  - `POST /movements/:id/submit`
- Key nen tao theo uuid tren moi action submit.

## 8) Module implementation order

1. Auth (login/me/logout + guards)
2. App layout + sidebar/header + role-based menu
3. Dashboard
4. Master data pages
5. Inventory pages
6. Receipt / Movement
7. Reservation / Issue / Picking
8. Cycle count
9. Approval + admin settings

