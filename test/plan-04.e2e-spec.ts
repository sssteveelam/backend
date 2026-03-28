import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

dotenv.config({ path: '.env.test' });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for e2e tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

describe('Plan 04 E2E - Receipt Workflow', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let adminUser: User;
  let managerUser: User;
  let staffUser: User;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;

  let warehouseAId: string;
  let locationL1Id: string;
  let supplierS1Id: string;
  let productP1Id: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.stock_lines,
        public.containers,
        public.receipt_lines,
        public.receipts,
        public.batches,
        public.product_uoms,
        public.locations,
        public.products,
        public.suppliers,
        public.warehouses,
        public.idempotency_keys,
        public.audit_events,
        public.users
      CASCADE;
    `);
  };

  const seedUsers = async (): Promise<void> => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@test.local',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    managerUser = await prisma.user.create({
      data: {
        username: 'manager',
        email: 'manager@test.local',
        passwordHash,
        role: 'manager',
        status: 'active',
      },
    });

    staffUser = await prisma.user.create({
      data: {
        username: 'staff',
        email: 'staff@test.local',
        passwordHash,
        role: 'staff',
        status: 'active',
      },
    });
  };

  const seedMasterData = async (): Promise<void> => {
    const warehouse = await prisma.warehouse.create({ data: { code: 'WH-A', name: 'Warehouse A' } });
    warehouseAId = warehouse.id;

    const location = await prisma.location.create({
      data: {
        warehouseId: warehouseAId,
        code: 'LOC-1',
        name: 'Location L1',
      },
    });
    locationL1Id = location.id;

    const supplier = await prisma.supplier.create({ data: { code: 'S1', name: 'Supplier S1' } });
    supplierS1Id = supplier.id;

    const product = await prisma.product.create({
      data: {
        code: 'P1',
        name: 'Product P1',
        baseUom: 'kg',
      },
    });
    productP1Id = product.id;

    await prisma.productUom.createMany({
      data: [
        {
          productId: productP1Id,
          supplierId: supplierS1Id,
          uom: 'box',
          factorToBase: '10',
        },
        {
          productId: productP1Id,
          supplierId: null,
          uom: 'box',
          factorToBase: '8',
        },
      ],
    });
  };

  const login = async (usernameOrEmail: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail,
      password: plainPassword,
    });

    return res.body.accessToken as string;
  };

  const createDraftReceipt = async (token: string, code = 'RC-001') => {
    return request(app.getHttpServer())
      .post('/receipts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'create-receipt')
      .send({
        code,
        supplierId: supplierS1Id,
        warehouseId: warehouseAId,
      });
  };

  const addLine = async (token: string, receiptId: string, payload: Record<string, unknown>) => {
    return request(app.getHttpServer())
      .post(`/receipts/${receiptId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'add-line')
      .send(payload);
  };

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });

    prisma = new PrismaClient();
    await prisma.$connect();

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  beforeEach(async () => {
    await resetAllTables();
    await seedUsers();
    await seedMasterData();

    adminToken = await login('admin');
    managerToken = await login('manager');
    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Create receipt', async () => {
    const res = await createDraftReceipt(staffToken, 'RC-T1');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');

    const inDb = await prisma.receipt.findUnique({ where: { id: res.body.id } });
    expect(inDb).toBeTruthy();
  });

  it('Test 2 — Add receipt line', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T2');

    const line = await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T2',
    });

    expect(line.status).toBe(201);

    const lineCount = await prisma.receiptLine.count({ where: { receiptId: receipt.body.id } });
    const stockCount = await prisma.stockLine.count();

    expect(lineCount).toBe(1);
    expect(stockCount).toBe(0);
  });

  it('Test 3 — Validation', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T3');

    const invalidQty = await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 0,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T3-A',
    });

    expect(invalidQty.status).toBe(400);

    const invalidDates = await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-12-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T3-B',
    });

    expect(invalidDates.status).toBe(400);
  });

  it('Test 4 — Submit receipt (happy path)', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T4');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T4',
    });

    const submit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t4')
      .set('Idempotency-Key', 'key-1')
      .send({});

    expect(submit.status).toBe(201);
    expect(submit.body.receipt.status).toBe('submitted');

    const stock = await prisma.stockLine.findMany();
    const batch = await prisma.batch.findFirst({ where: { lotCode: 'LOT-T4' } });

    expect(stock).toHaveLength(1);
    expect(Number(stock[0].quantityBase)).toBe(100);
    expect(batch).toBeTruthy();
  });

  it('Test 5 — Batch reuse', async () => {
    const receipt1 = await createDraftReceipt(staffToken, 'RC-T5-1');
    await addLine(staffToken, receipt1.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-REUSE',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt1.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t5-1')
      .set('Idempotency-Key', 'key-reuse-1')
      .send({});

    const receipt2 = await createDraftReceipt(staffToken, 'RC-T5-2');
    await addLine(staffToken, receipt2.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 5,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-REUSE',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt2.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t5-2')
      .set('Idempotency-Key', 'key-reuse-2')
      .send({});

    const batches = await prisma.batch.findMany({ where: { lotCode: 'LOT-REUSE' } });
    expect(batches).toHaveLength(1);

    const lines = await prisma.receiptLine.findMany({ where: { lotCode: 'LOT-REUSE' } });
    const uniqueBatchIds = new Set(lines.map((l) => l.batchId));
    expect(uniqueBatchIds.size).toBe(1);
  });

  it('Test 6 — Stock update', async () => {
    const receipt1 = await createDraftReceipt(staffToken, 'RC-T6-1');
    await addLine(staffToken, receipt1.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-STOCK',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt1.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t6-1')
      .set('Idempotency-Key', 'key-stock-1')
      .send({});

    const receipt2 = await createDraftReceipt(staffToken, 'RC-T6-2');
    await addLine(staffToken, receipt2.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 5,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-STOCK',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt2.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t6-2')
      .set('Idempotency-Key', 'key-stock-2')
      .send({});

    const stock = await prisma.stockLine.findMany();
    expect(stock).toHaveLength(1);
    expect(Number(stock[0].quantityBase)).toBe(150);
  });

  it('Test 7 — Container vs non-container', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T7');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-CONT-A',
      containerQrCode: 'CONT-1',
    });

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 5,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-CONT-B',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t7')
      .set('Idempotency-Key', 'key-t7')
      .send({});

    const stock = await prisma.stockLine.findMany({ orderBy: { createdAt: 'asc' } });
    expect(stock).toHaveLength(2);

    const withContainer = stock.find((s) => s.containerId !== null);
    const withoutContainer = stock.find((s) => s.containerId === null);

    expect(withContainer).toBeTruthy();
    expect(withoutContainer).toBeTruthy();
  });

  it('Test 8 — Idempotency', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T8');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-IDEM',
    });

    const first = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t8')
      .set('Idempotency-Key', 'idem-key-same')
      .send({});

    const stockAfterFirst = await prisma.stockLine.findMany();

    const second = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t8')
      .set('Idempotency-Key', 'idem-key-same')
      .send({});

    const stockAfterSecond = await prisma.stockLine.findMany();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(stockAfterSecond).toHaveLength(stockAfterFirst.length);
    expect(Number(stockAfterSecond[0].quantityBase)).toBe(Number(stockAfterFirst[0].quantityBase));
    expect(second.body).toEqual(first.body);
  });

  it('Test 9 — Transaction rollback', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T9');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T9-1',
    });

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 5,
      uom: 'unknown-uom',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T9-2',
    });

    const submit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t9')
      .set('Idempotency-Key', 'key-t9')
      .send({});

    expect(submit.status).toBeGreaterThanOrEqual(400);

    const stockCount = await prisma.stockLine.count();
    expect(stockCount).toBe(0);
  });

  it('Test 10 — Near-expiry warning', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T10');
    const nearExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 2,
      uom: 'box',
      unitCost: 50,
      manufactureDate: '2026-01-01',
      expiryDate: nearExpiry,
      lotCode: 'LOT-T10',
    });

    const submit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t10')
      .set('Idempotency-Key', 'key-t10')
      .send({});

    expect(submit.status).toBe(201);
    expect(submit.body.receipt.status).toBe('submitted');
    expect(Array.isArray(submit.body.warnings)).toBe(true);
    expect(submit.body.warnings.length).toBeGreaterThan(0);
  });

  it('Test 11 — Average cost', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T11');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-AVG',
    });

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 200,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-AVG',
    });

    const submit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t11')
      .set('Idempotency-Key', 'key-t11')
      .send({});

    expect(submit.status).toBe(201);

    const batch = await prisma.batch.findFirst({ where: { lotCode: 'LOT-AVG' } });
    expect(batch).toBeTruthy();
    expect(Number(batch?.averageCost)).toBe(150);
  });

  it('Test 12 — RBAC', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T12');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 10,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T12',
    });

    const staffSubmit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'submit-t12-staff')
      .set('Idempotency-Key', 'key-t12-staff')
      .send({});

    expect(staffSubmit.status).toBe(403);

    const managerSubmit = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t12-manager')
      .set('Idempotency-Key', 'key-t12-manager')
      .send({});

    expect(managerSubmit.status).toBe(201);

    const adminCancel = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'cancel-t12')
      .send({});

    expect(adminCancel.status).toBeGreaterThanOrEqual(400);
  });

  it('Test 13 — Cancel receipt', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T13');

    const cancel = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'cancel-t13')
      .send({});

    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe('cancelled');

    const fromDb = await prisma.receipt.findUnique({ where: { id: receipt.body.id } });
    expect(fromDb?.status).toBe('cancelled');
  });

  it('Test 14 — Audit', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T14');

    const line = await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 3,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T14',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'submit-t14')
      .set('Idempotency-Key', 'key-t14')
      .send({});

    const actions = [
      'CREATE_RECEIPT',
      'ADD_RECEIPT_LINE',
      'SUBMIT_RECEIPT',
      'UPDATE_STOCK_LINE_FROM_RECEIPT',
    ];

    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: actions },
      },
    });

    const createReceiptEvent = events.find((e) => e.action === 'CREATE_RECEIPT');
    const addLineEvent = events.find((e) => e.action === 'ADD_RECEIPT_LINE' && e.entityId === line.body.id);
    const submitEvent = events.find((e) => e.action === 'SUBMIT_RECEIPT' && e.entityId === receipt.body.id);
    const stockEvent = events.find((e) => e.action === 'UPDATE_STOCK_LINE_FROM_RECEIPT');

    expect(createReceiptEvent).toBeTruthy();
    expect(addLineEvent).toBeTruthy();
    expect(submitEvent).toBeTruthy();
    expect(stockEvent).toBeTruthy();

    expect(createReceiptEvent?.actorUserId).toBe(staffUser.id);
    expect(addLineEvent?.actorUserId).toBe(staffUser.id);
    expect(submitEvent?.actorUserId).toBe(managerUser.id);

    expect(createReceiptEvent?.beforeJson).toBeNull();
    expect(createReceiptEvent?.afterJson).toBeTruthy();
    expect(addLineEvent?.beforeJson).toBeNull();
    expect(addLineEvent?.afterJson).toBeTruthy();
    expect(submitEvent?.beforeJson).toBeTruthy();
    expect(submitEvent?.afterJson).toBeTruthy();
    expect(stockEvent?.beforeJson).toBeNull();
    expect(stockEvent?.afterJson).toBeTruthy();
  });

  it('Test 15 — Context propagation', async () => {
    const receipt = await createDraftReceipt(staffToken, 'RC-T15');

    await addLine(staffToken, receipt.body.id, {
      productId: productP1Id,
      supplierId: supplierS1Id,
      quantity: 1,
      uom: 'box',
      unitCost: 100,
      manufactureDate: '2026-01-01',
      expiryDate: '2026-12-01',
      lotCode: 'LOT-T15',
    });

    await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'receipt-123')
      .set('Idempotency-Key', 'key-t15')
      .send({});

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: 'SUBMIT_RECEIPT',
        entityId: receipt.body.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).toBeTruthy();
    expect(audit?.correlationId).toBe('receipt-123');
  });
});
