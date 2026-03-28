const fs = require('fs');
const path = require('path');

const bCryptHash = '$2b$10$qIbcdMbhxR1GiPEYTIya5.7ZIEZZw9JSCM2F0jwLdNGSAcWAvkt5m';

const genUuid = (prefix, num) => {
    return `${prefix.toString().padStart(8, '0')}-0000-0000-0000-${num.toString().padStart(12, '0')}`;
};

const escape = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

let sql = `BEGIN;\n\n`;

sql += `DO $$
BEGIN
    -- Only optional extension
    -- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
END $$;\n\n`;

// 1. Users
sql += `-- 1. USERS\n`;
const users = [
    { i: 1, u: 'staff_demo', m: 'staff_demo@example.com', r: 'staff' },
    { i: 2, u: 'manager_demo', m: 'manager_demo@example.com', r: 'manager' },
    { i: 3, u: 'admin_demo', m: 'admin_demo@example.com', r: 'admin' }
];
sql += `INSERT INTO users (id, username, email, password_hash, role, status, created_at) VALUES \n`;
sql += users.map(u => `('${genUuid(1, u.i)}', '${u.u}', '${u.m}', '${bCryptHash}', '${u.r}'::"UserRole", 'ACTIVE', NOW() - INTERVAL '30 days')`).join(',\n') + `\nON CONFLICT (username) DO NOTHING;\n\n`;

// 2. Warehouses
sql += `-- 2. WAREHOUSES\n`;
sql += `INSERT INTO warehouses (id, code, name, created_at) VALUES \n`;
sql += `('${genUuid(2, 1)}', 'DEMO-WH-A', 'Demo Main Warehouse A', NOW() - INTERVAL '29 days'),\n`;
sql += `('${genUuid(2, 2)}', 'DEMO-WH-B', 'Demo Secondary Warehouse B', NOW() - INTERVAL '29 days')\n`;
sql += `ON CONFLICT (code) DO NOTHING;\n\n`;

// 3. Locations
sql += `-- 3. LOCATIONS\n`;
sql += `INSERT INTO locations (id, warehouse_id, code, name, capacity_limit_base) VALUES \n`;
const locs = [];
for (let w = 1; w <= 2; w++) {
    for (let l = 1; l <= 3; l++) {
        let locId = (w - 1) * 3 + l;
        let c = w === 1 ? `A-0${l}` : `B-0${l}`;
        locs.push(`('${genUuid(3, locId)}', '${genUuid(2, w)}', 'DEMO-${c}', '${c} Name', ${locId * 1000.0})`);
    }
}
sql += locs.join(',\n') + `\nON CONFLICT (warehouse_id, code) DO NOTHING;\n\n`;

// 4. Suppliers
sql += `-- 4. SUPPLIERS\n`;
sql += `INSERT INTO suppliers (id, code, name) VALUES \n`;
const sups = [];
for (let i = 1; i <= 5; i++) {
    sups.push(`('${genUuid(4, i)}', 'DEMO-SUP-${String(i).padStart(3, '0')}', 'Demo Supplier ${i}')`);
}
sql += sups.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

// 5. Products
sql += `-- 5. PRODUCTS\n`;
sql += `INSERT INTO products (id, code, name, base_uom) VALUES \n`;
const prods = [];
for (let i = 1; i <= 12; i++) {
    prods.push(`('${genUuid(5, i)}', 'DEMO-PROD-${String(i).padStart(3, '0')}', 'Demo Product ${i}', 'Pieces')`);
}
sql += prods.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

// 6. Product UOMs
sql += `-- 6. PRODUCT UOMS\n`;
sql += `INSERT INTO product_uoms (id, product_id, supplier_id, uom, factor_to_base) VALUES \n`;
const uoms = [];
for (let i = 1; i <= 12; i++) {
    uoms.push(`('${genUuid(6, i * 2 - 1)}', '${genUuid(5, i)}', NULL, 'Pieces', 1.0)`);
    uoms.push(`('${genUuid(6, i * 2)}', '${genUuid(5, i)}', NULL, 'Box', 10.0)`);
}
sql += uoms.join(',\n') + `\nON CONFLICT (product_id, supplier_id, uom) DO NOTHING;\n\n`;

// 7. Batches (12: 4 near, 4 normal, 4 long)
sql += `-- 7. BATCHES\n`;
sql += `INSERT INTO batches (id, product_id, supplier_id, manufacture_date, expiry_date, lot_code, average_cost, created_at) VALUES \n`;
const batches = [];
for (let i = 1; i <= 12; i++) {
    let pId = genUuid(5, i);
    let sId = genUuid(4, (i % 5) + 1);
    let exp = i <= 4 ? "CURRENT_DATE + INTERVAL '10 days'" : (i <= 8 ? "CURRENT_DATE + INTERVAL '4 months'" : "CURRENT_DATE + INTERVAL '10 months'");
    batches.push(`('${genUuid(7, i)}', '${pId}', '${sId}', CURRENT_DATE - INTERVAL '1 year', ${exp}, 'DEMO-LOT-${String(i).padStart(3, '0')}', ${10.5}, NOW() - INTERVAL '20 days')`);
}
sql += batches.join(',\n') + `\nON CONFLICT (product_id, supplier_id, manufacture_date, expiry_date, lot_code) DO NOTHING;\n\n`;

// 8. Containers (20)
sql += `-- 8. CONTAINERS\n`;
sql += `INSERT INTO containers (id, qr_code, location_id, status, is_sealed, created_at) VALUES \n`;
const conts = [];
for (let i = 1; i <= 20; i++) {
    let locId = genUuid(3, (i % 6) + 1);
    conts.push(`('${genUuid(8, i)}', 'DEMO-CONT-${String(i).padStart(4, '0')}', '${locId}', 'Open', false, NOW() - INTERVAL '10 days')`);
}
sql += conts.join(',\n') + `\nON CONFLICT (qr_code) DO NOTHING;\n\n`;

// 9. Stock Lines
sql += `-- 9. STOCK LINES\n`;
sql += `INSERT INTO stock_lines (id, product_id, batch_id, location_id, container_id, quantity_base, created_at) VALUES \n`;
const stocks = [];
for (let i = 1; i <= 8; i++) { // Rải 8 products
    let pId = genUuid(5, i);
    let bId = genUuid(7, i); // batch corresponds to product index loosely here
    let locId = genUuid(3, (i % 6) + 1);
    let cId = i <= 3 ? `'${genUuid(8, i)}'` : 'NULL'; // At least 3 containers used
    stocks.push(`('${genUuid(9, i)}', '${pId}', '${bId}', '${locId}', ${cId}, 500.0, NOW())`);
}
sql += stocks.join(',\n') + `\nON CONFLICT (product_id, batch_id, location_id, container_id) DO NOTHING;\n\n`;

// 10. Receipts (3 submitted, 2 drafted)
sql += `-- 10. RECEIPTS & LINES\n`;
sql += `INSERT INTO receipts (id, code, supplier_id, warehouse_id, status, total_value, created_by, created_at) VALUES \n`;
const rcs = [];
for (let i = 1; i <= 5; i++) {
    let st = i <= 3 ? 'submitted' : 'draft';
    rcs.push(`('${genUuid(10, i)}', 'DEMO-RCPT-${String(i).padStart(4, '0')}', '${genUuid(4, 1)}', '${genUuid(2, 1)}', '${st}', 1000.0, '${genUuid(1, 1)}', NOW() - INTERVAL '${i} days')`);
}
sql += rcs.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

sql += `INSERT INTO receipt_lines (id, receipt_id, product_id, supplier_id, batch_id, quantity, quantity_base, uom, unit_cost, manufacture_date, expiry_date, lot_code, container_qr_code, created_at) VALUES \n`;
const rcLines = [];
let rlIt = 1;
for (let i = 1; i <= 5; i++) {
    for (let j = 1; j <= 3; j++) {
        rcLines.push(`('${genUuid(11, rlIt)}', '${genUuid(10, i)}', '${genUuid(5, j)}', '${genUuid(4, 1)}', '${genUuid(7, j)}', 10, 10, 'Pieces', 10.0, CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '1 year', 'DEMO-LOT-R${rlIt}', NULL, NOW())`);
        rlIt++;
    }
}
sql += rcLines.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

// 11. Movements (3 submitted)
sql += `-- 11. MOVEMENTS & LINES\n`;
sql += `INSERT INTO movements (id, code, from_location_id, to_location_id, status, created_by, created_at) VALUES \n`;
const mvs = [];
for (let i = 1; i <= 3; i++) {
    mvs.push(`('${genUuid(12, i)}', 'DEMO-MV-${String(i).padStart(4, '0')}', '${genUuid(3, 1)}', '${genUuid(3, 2)}', 'submitted', '${genUuid(1, 1)}', NOW() - INTERVAL '1 day')`);
}
sql += mvs.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

sql += `INSERT INTO movement_lines (id, movement_id, product_id, batch_id, container_id, quantity_base, created_at) VALUES \n`;
const mvLines = [];
let mvIt = 1;
for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 2; j++) {
        mvLines.push(`('${genUuid(13, mvIt)}', '${genUuid(12, i)}', '${genUuid(5, j)}', '${genUuid(7, j)}', NULL, 5.0, NOW())`);
        mvIt++;
    }
}
sql += mvLines.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

// 12. Issues & Pick Tasks & Reservations
sql += `-- 12. ISSUES, RESERVATIONS, PICK TASKS\n`;
sql += `INSERT INTO issues (id, code, status, created_by, created_at) VALUES \n`;
const iss = [];
for(let i=1; i<=4; i++){
    iss.push(`('${genUuid(14, i)}', 'DEMO-ISS-${String(i).padStart(4, '0')}', 'planned', '${genUuid(1, 1)}', NOW() - INTERVAL '2 days')`);
}
sql += iss.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

sql += `INSERT INTO issue_lines (id, issue_id, product_id, quantity_base, created_at) VALUES \n`;
const issLines = [];
let issIt=1;
for(let i=1; i<=4; i++) {
    for(let j=1; j<=2; j++) {
        issLines.push(`('${genUuid(15, issIt)}', '${genUuid(14, i)}', '${genUuid(5, j)}', 2.0, NOW())`);
        issIt++;
    }
}
sql += issLines.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

// Reservations
sql += `INSERT INTO reservations (id, product_id, batch_id, location_id, container_id, quantity_base, status, expires_at, last_activity_at, created_by, created_at) VALUES \n`;
const rsvs = [
    `('${genUuid(16, 1)}', '${genUuid(5, 1)}', '${genUuid(7, 1)}', '${genUuid(3, 1)}', NULL, 2.0, 'soft-reserved', NOW() + INTERVAL '1 day', NOW(), '${genUuid(1,1)}', NOW())`,
    `('${genUuid(16, 2)}', '${genUuid(5, 2)}', '${genUuid(7, 2)}', '${genUuid(3, 1)}', NULL, 2.0, 'hard-locked', NOW() + INTERVAL '1 day', NOW(), '${genUuid(1,1)}', NOW())`,
    `('${genUuid(16, 3)}', '${genUuid(5, 3)}', '${genUuid(7, 3)}', '${genUuid(3, 1)}', NULL, 2.0, 'released', NOW() - INTERVAL '1 day', NOW(), '${genUuid(1,1)}', NOW())`
];
sql += rsvs.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

sql += `INSERT INTO pick_tasks (id, issue_line_id, product_id, batch_id, location_id, container_id, reservation_id, quantity_base, picked_quantity, status, created_at) VALUES \n`;
const pts = [];
let ptIt=1;
for(let i=1; i<=8; i++) { // 8 issue lines
    let rs = i<=2 ? `'${genUuid(16, i)}'` : 'NULL';
    pts.push(`('${genUuid(17, ptIt)}', '${genUuid(15, ptIt)}', '${genUuid(5, 1)}', '${genUuid(7, 1)}', '${genUuid(3, 1)}', NULL, ${rs}, 2.0, 0, 'pending', NOW())`);
    ptIt++;
}
sql += pts.join(',\n') + `\nON CONFLICT (reservation_id) DO NOTHING;\n\n`;

// 13. Cycle Counts (2 sub, 1 draft)
sql += `-- 13. CYCLE COUNTS\n`;
sql += `INSERT INTO cycle_counts (id, code, location_id, status, created_by, created_at) VALUES \n`;
const ccs = [];
for(let i=1; i<=3; i++){
    let st = i<=2 ? 'submitted' : 'draft';
    ccs.push(`('${genUuid(18, i)}', 'DEMO-CC-${String(i).padStart(4, '0')}', '${genUuid(3, i)}', '${st}', '${genUuid(1, 1)}', NOW() - INTERVAL '3 days')`);
}
sql += ccs.join(',\n') + `\nON CONFLICT (code) DO NOTHING;\n\n`;

sql += `INSERT INTO cycle_count_lines (id, cycle_count_id, product_id, batch_id, container_id, counted_quantity, created_at) VALUES \n`;
const ccLines = [];
let ccIt=1;
for(let i=1; i<=3; i++) {
    ccLines.push(`('${genUuid(19, ccIt)}', '${genUuid(18, i)}', '${genUuid(5, 1)}', '${genUuid(7, 1)}', NULL, 150.0, NOW())`);
    ccIt++;
}
sql += ccLines.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

// 14. Approvals (5 pending, 2 approved, 1 rejected)
sql += `-- 14. APPROVALS\n`;
sql += `INSERT INTO approval_requests (id, document_type, document_id, status, reason, po_code, threshold_snapshot, requested_by, created_at) VALUES \n`;
const apps = [];
const appStatuses = ['pending','pending','pending','pending','pending','approved','approved','rejected'];
for(let i=1; i<=8; i++) {
    apps.push(`('${genUuid(20, i)}', 'RECEIPT', '${genUuid(10, 1)}', '${appStatuses[i-1]}', 'Demo Reason', NULL, '{}'::jsonb, '${genUuid(1,1)}', NOW())`);
}
// since unique constrain is documentType, documentId => wait! The schema says @@unique([documentType, documentId]).
// that means I can't insert 8 records for the same RECEIPT 1! 
// Let's modify the documentId.
const appsSafe = [];
for(let i=1; i<=8; i++) {
    // vary document_type or document_id!
    appsSafe.push(`('${genUuid(20, i)}', 'RECEIPT_${i}', '${genUuid(10, 1)}', '${appStatuses[i-1]}', 'Demo Reason', NULL, '{}'::jsonb, '${genUuid(1,1)}', NOW())`);
}
sql += appsSafe.join(',\n') + `\nON CONFLICT (document_type, document_id) DO NOTHING;\n\n`;

// 15. Config Timeout
sql += `-- 15. CONFIG TIMEOUT\n`;
sql += `INSERT INTO app_timeout_config (id, soft_reserve_minutes, hard_lock_minutes, updated_at) VALUES ('default', 30, 60, NOW()) ON CONFLICT (id) DO NOTHING;\n\n`;

// 16. Audit Events (50)
sql += `-- 16. AUDIT EVENTS\n`;
sql += `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, before_json, after_json, reason, correlation_id, created_at) VALUES \n`;
const auds = [];
for(let i=1; i<=50; i++){
    auds.push(`('${genUuid(21, i)}', '${genUuid(1,1)}', 'DEMO_ACTION', 'receipts', '${genUuid(10,1)}', NULL, '{}'::jsonb, 'Demo audit', 'corr-${i}', NOW() - INTERVAL '${i%30} days')`);
}
sql += auds.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n\n`;

// END
sql += `COMMIT;\n\n`;

// Sanity Queries
sql += `-- ==========================================\n`;
sql += `-- SANITY QUERIES\n`;
sql += `-- ==========================================\n`;
const tbls = ['users','warehouses','locations','suppliers','products','batches','containers','stock_lines','receipts','movements','issues','pick_tasks','cycle_counts','approval_requests','audit_events','app_timeout_config'];
for(let t of tbls) {
    sql += `SELECT '${t}' AS "table", COUNT(*) AS "total" FROM ${t};\n`;
}

fs.writeFileSync(path.join(__dirname, 'seed_demo_full.sql'), sql);
console.log('SQL Generated gracefully!');
