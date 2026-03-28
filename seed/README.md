# WMS Full Demo Data Seed

This directory contains `seed_demo_full.sql`, an idempotent data seeding script that fully populates your WMS PostgreSQL database with realistic demo scenarios.

## Contents Overview
The script inserts records across the major operational tables defined in your `schema.prisma`:
- **Auth**: `users` (3 accounts)
- **Master Data**: `warehouses`, `locations`, `suppliers`, `products`, `product_uoms`.
- **Inventory Core**: `batches`, `containers`, `stock_lines`.
- **Workflows**: `receipts` (+ `receipt_lines`), `movements` (+ `movement_lines`), `issues` (+ `issue_lines`).
- **Warehouse Execution**: `reservations`, `pick_tasks`, `cycle_counts` (+ `cycle_count_lines`).
- **Review & Tracking**: `approval_requests`, `audit_events`, `app_timeout_config`.

## Demo Accounts

All credentials use the Bcrypt `$2b$10$...` mechanism generated directly from your backend's configuration defaults.

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin_demo` | `123456` |
| **Manager** | `manager_demo` | `123456` |
| **Staff** | `staff_demo` | `123456` |

## Execution Instructions

Because the script uses `ON CONFLICT DO NOTHING`, **it is completely safe to run multiple times**. Running it again will not corrupt or duplicate data. 

### Method 1: Using pgAdmin4 (Recommended)
1. Open **pgAdmin 4** and connect to your database (e.g. `wms_mvp`).
2. Right click the database name -> **Query Tool**.
3. Open the file `seed_demo_full.sql` in the Query Tool or copy & paste its entire contents.
4. Click the **Execute/Refresh (F5)** button.
5. In the **Messages** pane, you should see the successful transaction commit. In the **Data Output** pane, you will see the Sanity Queries displaying exact row counts of inserted records across 16 tables.

### Method 2: Using Command Line (psql)
If you have the `psql` client installed locally:
```bash
psql -U postgres -d wms_mvp -f backend/seed/seed_demo_full.sql
```

## Disclaimers / Skipped Data
- No tables were skipped from your Prisma architecture. Every active mapped relation is completely covered with strict Foreign-Key logic using deterministic UUIDs (e.g., `00000010-...`).
- The `app_timeout_config` logic handles the exact unique primary key defaults mapped in Prisma. 
- You can freely use your application's API endpoints or UI interactions directly after seeding to observe how frontend charts and histories naturally display these records.
