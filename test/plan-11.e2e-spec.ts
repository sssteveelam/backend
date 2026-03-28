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

describe('Plan 11 E2E - Capacity warnings + override', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffUser: User;
  let managerUser: User;
  let adminUser: User;
  let staffToken: string;
  let managerToken: string;
  let adminToken: string;

  let warehouseId: string;
  let locationL1Id: string;
  let locationL2Id: string;
  let supplierId: string;
  let productId: string;
  let batchId: string;
  let movementContainerId: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.pick_tasks,
        public.issue_lines,
        public.issues,
        public.reservations,
        public.approval_requests,
        public.movement_lines,
        public.movements,
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

  const seedUsers = async () => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    staffUser = await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
    });
    managerUser = await prisma.user.create({
      data: { username: 'manager', email: 'manager@test.local', passwordHash, role: 'manager', status: 'active' },
    });
    adminUser = await prisma.user.create({
      data: { username: 'admin', email: 'admin@test.local', passwordHash, role: 'admin', status: 'active' },
    });
  };

  const seedBaseData = async () => {
    const wh = await prisma.warehouse.create({ data: { code: 'WH-1', name: 'Warehouse 1' } });
    warehouseId = wh.id;

    const l1 = await prisma.location.create({
      data: { warehouseId, code: 'L1', name: 'Location L1', capacityLimitBase: 100 },
    });
    locationL1Id = l1.id;
    const l2 = await prisma.location.create({
      data: { warehouseId, code: 'L2', name: 'Location L2', capacityLimitBase: 200 },
    });
    locationL2Id = l2.id;

    const s1 = await prisma.supplier.create({ data: { code: 'S1', name: 'Supplier S1' } });
    supplierId = s1.id;

    const p1 = await prisma.product.create({
      data: { code: 'P1', name: 'Product P1', baseUom: 'kg' },
    });
    productId = p1.id;

    await prisma.productUom.create({
      data: { productId, supplierId, uom: 'box', factorToBase: 1 },
    });

    const b1 = await prisma.batch.create({
      data: {
        productId,
        supplierId,
        lotCode: 'B-SEED',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
        averageCost: 1000,
      },
    });
    batchId = b1.id;

    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId: locationL1Id,
        quantityBase: 90,
      },
    });

    movementContainerId = (
      await prisma.container.create({
        data: { qrCode: 'MOVE-C1', locationId: locationL2Id },
      })
    ).id;

    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId: locationL2Id,
        containerId: movementContainerId,
        quantityBase: 80,
      },
    });
  };

  const login = async (usernameOrEmail: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail, password: plainPassword });
    return res.body.accessToken as string;
  };

  const createReceiptWithIncoming = async (incoming: number, code: string, token = staffToken) => {
    const receipt = await request(app.getHttpServer())
      .post('/receipts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `create-${code}`)
      .send({ code, supplierId, warehouseId });
    expect(receipt.status).toBe(201);

    const line = await request(app.getHttpServer())
      .post(`/receipts/${receipt.body.id}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `line-${code}`)
      .send({
        productId,
        supplierId,
        quantity: incoming,
        uom: 'box',
        unitCost: 1000,
        manufactureDate: '2026-01-01',
        expiryDate: '2026-12-31',
        lotCode: `LOT-${code}`,
      });
    expect(line.status).toBe(201);
    return receipt.body.id as string;
  };

  const submitReceipt = async (
    receiptId: string,
    key: string,
    token = managerToken,
    body: Record<string, unknown> = {},
    correlationId = `submit-${key}`,
  ) =>
    request(app.getHttpServer())
      .post(`/receipts/${receiptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .set('Idempotency-Key', key)
      .send(body);

  const createMovementIntoL1 = async (quantityBase: number, code: string, token = staffToken) => {
    const movement = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `mv-create-${code}`)
      .send({ code, fromLocationId: locationL2Id, toLocationId: locationL1Id });
    expect(movement.status).toBe(201);

    const line = await request(app.getHttpServer())
      .post(`/movements/${movement.body.id}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `mv-line-${code}`)
      .send({
        productId,
        batchId,
        containerId: movementContainerId,
        quantityBase,
      });
    expect(line.status).toBe(201);

    return movement.body.id as string;
  };

  const submitMovement = async (
    movementId: string,
    key: string,
    token = managerToken,
    body: Record<string, unknown> = {},
  ) =>
    request(app.getHttpServer())
      .post(`/movements/${movementId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `mv-submit-${key}`)
      .set('Idempotency-Key', key)
      .send({
        scanSequence: ['container', 'location'],
        scannedContainerId: movementContainerId,
        scannedContainerQr: 'MOVE-C1',
        scannedLocationId: locationL1Id,
        scannedLocationQr: 'L1',
        ...body,
      });

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });

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
    await seedBaseData();
    staffToken = await login('staff');
    managerToken = await login('manager');
    adminToken = await login('admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Không vượt capacity', async () => {
    const receiptId = await createReceiptWithIncoming(5, 'T1');
    const submit = await submitReceipt(receiptId, 'key-t1');
    expect(submit.status).toBe(201);
    expect(submit.body.capacityWarning.isOver).toBe(false);
    expect(submit.body.overrideRequired).toBe(false);
  });

  it('Test 2 — SMALL_OVER', async () => {
    const receiptId = await createReceiptWithIncoming(15, 'T2');
    const submit = await submitReceipt(receiptId, 'key-t2');
    expect(submit.status).toBe(201);
    expect(submit.body.capacityWarning.isOver).toBe(true);
    expect(submit.body.capacityWarning.isBigOver).toBe(false);
    expect(submit.body.overrideRequired).toBe(true);
    expect(submit.body.blocked).toBe(false);
  });

  it('Test 3 — BIG_OVER', async () => {
    const receiptId = await createReceiptWithIncoming(30, 'T3');
    const submit = await submitReceipt(receiptId, 'key-t3');
    expect(submit.status).toBe(201);
    expect(submit.body.capacityWarning.isOver).toBe(true);
    expect(submit.body.capacityWarning.isBigOver).toBe(true);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();
  });

  it('Test 4 — BIG_OVER staff override phải fail', async () => {
    const receiptId = await createReceiptWithIncoming(30, 'T4');
    const submit = await submitReceipt(receiptId, 'key-t4', staffToken, {
      overrideCapacity: true,
      overrideReason: 'test',
    });
    expect(submit.status).toBe(403);
    expect(String(submit.body.error.message)).toContain('BIG_OVER_REQUIRES_APPROVAL');
  });

  it('Test 5 — SMALL_OVER staff override thành công', async () => {
    const receiptId = await createReceiptWithIncoming(15, 'T5');
    const submit = await submitReceipt(receiptId, 'key-t5', staffToken, {
      overrideCapacity: true,
      overrideReason: 'small over',
    });
    expect(submit.status).toBe(201);
    expect(submit.body.receipt.status).toBe('submitted');
    expect(submit.body.overrideRequired).toBe(false);
    expect(submit.body.capacityWarning.isOver).toBe(true);
  });

  it('Test 6 — Override thiếu reason phải fail', async () => {
    const receiptId = await createReceiptWithIncoming(15, 'T6');
    const submit = await submitReceipt(receiptId, 'key-t6', staffToken, {
      overrideCapacity: true,
    });
    expect(submit.status).toBe(400);
  });

  it('Test 7 — Manager override BIG_OVER thành công', async () => {
    const receiptId = await createReceiptWithIncoming(30, 'T7');
    const submit = await submitReceipt(receiptId, 'key-t7', managerToken, {
      overrideCapacity: true,
      overrideReason: 'approved',
    });
    expect(submit.status).toBe(201);
    expect(submit.body.receipt.status).toBe('submitted');
    expect(submit.body.blocked).toBe(false);
    expect(submit.body.approvalRequestId).toBeNull();
  });

  it('Test 8 — Approval flow BIG_OVER pending', async () => {
    const receiptId = await createReceiptWithIncoming(30, 'T8');
    const submit = await submitReceipt(receiptId, 'key-t8');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: submit.body.approvalRequestId as string },
    });
    expect(approval).toBeTruthy();
    expect(approval?.status).toBe('pending');
  });

  it('Test 9 — Movement integration', async () => {
    const movementId = await createMovementIntoL1(15, 'T9');
    const submit = await submitMovement(movementId, 'key-t9');
    expect(submit.status).toBe(201);
    expect(submit.body.capacityWarning.isOver).toBe(true);
    expect(submit.body.capacityWarning.isBigOver).toBe(false);
    expect(submit.body.overrideRequired).toBe(true);
    expect(submit.body.blocked).toBe(false);
  });

  it('Test 10 — Audit chứa CAPACITY_WARNING và CAPACITY_OVERRIDE', async () => {
    const receiptA = await createReceiptWithIncoming(15, 'T10-A');
    await submitReceipt(receiptA, 'key-t10-a');

    const receiptB = await createReceiptWithIncoming(15, 'T10-B');
    await submitReceipt(receiptB, 'key-t10-b', staffToken, {
      overrideCapacity: true,
      overrideReason: 'override for audit',
    });

    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: ['CAPACITY_WARNING', 'CAPACITY_OVERRIDE'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(events.some((x) => x.action === 'CAPACITY_WARNING')).toBe(true);
    expect(events.some((x) => x.action === 'CAPACITY_OVERRIDE')).toBe(true);

    for (const event of events) {
      expect(event.actorUserId).toBeTruthy();
      expect(event.correlationId).toBeTruthy();
      expect(event.beforeJson).toBeTruthy();
      expect(event.afterJson).toBeTruthy();

      const after = event.afterJson as { overPercentage?: number; overAmount?: number; newTotal?: number };
      expect(after.overPercentage).toBeDefined();
      expect(after.overAmount).toBeDefined();
      expect(after.newTotal).toBeDefined();

      if (event.action === 'CAPACITY_OVERRIDE') {
        expect(event.reason).toBeTruthy();
      }
    }
  });

  it('Test 11 — Context propagation', async () => {
    const receiptId = await createReceiptWithIncoming(15, 'T11');
    await submitReceipt(
      receiptId,
      'key-t11',
      staffToken,
      { overrideCapacity: true, overrideReason: 'corr test' },
      'capacity-123',
    );

    const event = await prisma.auditEvent.findFirst({
      where: { action: 'CAPACITY_OVERRIDE', entityId: receiptId },
      orderBy: { createdAt: 'desc' },
    });
    expect(event?.correlationId).toBe('capacity-123');
  });

  it('Test 12 — Không bypass capacity check', async () => {
    const receiptId = await createReceiptWithIncoming(15, 'T12');
    const submit = await submitReceipt(receiptId, 'key-t12', managerToken, {});
    expect(submit.status).toBe(201);
    expect(submit.body.capacityWarning.isOver).toBe(true);
    expect(submit.body.overrideRequired).toBe(true);
  });

  it('Test 13 — BIG_OVER threshold detect đúng', async () => {
    await prisma.stockLine.deleteMany();
    await prisma.location.update({
      where: { id: locationL1Id },
      data: { capacityLimitBase: 40 },
    });
    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId: locationL1Id,
        quantityBase: 39,
      },
    });
    const r1 = await createReceiptWithIncoming(6, 'T13-PERCENT');
    const s1 = await submitReceipt(r1, 'key-t13-percent');
    expect(s1.body.capacityWarning.isBigOver).toBe(true);

    await prisma.stockLine.deleteMany();
    await prisma.location.update({
      where: { id: locationL1Id },
      data: { capacityLimitBase: 100 },
    });
    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId: locationL1Id,
        quantityBase: 96,
      },
    });
    const r2 = await createReceiptWithIncoming(10, 'T13-UNITS');
    const s2 = await submitReceipt(r2, 'key-t13-units');
    expect(s2.body.capacityWarning.isBigOver).toBe(true);

    await prisma.stockLine.deleteMany();
    await prisma.location.update({
      where: { id: locationL1Id },
      data: { capacityLimitBase: 1000 },
    });
    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId: locationL1Id,
        quantityBase: 970,
      },
    });
    const r3 = await createReceiptWithIncoming(90, 'T13-KG');
    const s3 = await submitReceipt(r3, 'key-t13-kg');
    expect(s3.body.capacityWarning.isBigOver).toBe(true);
  });
});
