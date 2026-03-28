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

describe('Plan 05 E2E - Movement Workflow + Scan + Admin Adjustment', () => {
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
  let locationL2Id: string;
  let supplierS1Id: string;
  let productP1Id: string;
  let batchB1Id: string;
  let containerC1Id: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
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

  const seedMovementData = async (): Promise<void> => {
    const warehouse = await prisma.warehouse.create({
      data: { code: 'WH-A', name: 'Warehouse A' },
    });
    warehouseAId = warehouse.id;

    const locationL1 = await prisma.location.create({
      data: {
        warehouseId: warehouseAId,
        code: 'LOC-1',
        name: 'Location L1',
      },
    });
    locationL1Id = locationL1.id;

    const locationL2 = await prisma.location.create({
      data: {
        warehouseId: warehouseAId,
        code: 'LOC-2',
        name: 'Location L2',
      },
    });
    locationL2Id = locationL2.id;

    const supplier = await prisma.supplier.create({
      data: { code: 'S1', name: 'Supplier S1' },
    });
    supplierS1Id = supplier.id;

    const product = await prisma.product.create({
      data: { code: 'P1', name: 'Product P1', baseUom: 'kg' },
    });
    productP1Id = product.id;

    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'B1',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
      },
    });
    batchB1Id = batch.id;

    const container = await prisma.container.create({
      data: {
        qrCode: 'CONT-1',
        locationId: locationL1Id,
      },
    });
    containerC1Id = container.id;

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL1Id,
        containerId: containerC1Id,
        quantityBase: '100',
      },
    });
  };

  const login = async (usernameOrEmail: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail,
      password: plainPassword,
    });

    return res.body.accessToken as string;
  };

  const createMovement = async (
    token: string,
    code: string,
    fromLocationId = locationL1Id,
    toLocationId = locationL2Id,
    correlationId = `create-${code}`,
  ) => {
    return request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .send({
        code,
        fromLocationId,
        toLocationId,
      });
  };

  const addMovementLine = async (
    token: string,
    movementId: string,
    payload: {
      productId: string;
      batchId: string;
      containerId?: string;
      quantityBase: number;
    },
    correlationId = `add-line-${movementId}`,
  ) => {
    return request(app.getHttpServer())
      .post(`/movements/${movementId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .send(payload);
  };

  const submitMovement = async (
    token: string,
    movementId: string,
    idempotencyKey: string,
    payload: {
      scanSequence: string[];
      scannedContainerId: string;
      scannedContainerQr: string;
      scannedLocationId: string;
      scannedLocationQr: string;
    },
    correlationId = `submit-${movementId}`,
  ) => {
    return request(app.getHttpServer())
      .post(`/movements/${movementId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
  };

  const getStockQty = async (
    locationId: string,
    containerId: string | null,
    productId = productP1Id,
    batchId = batchB1Id,
  ): Promise<number> => {
    const stock = await prisma.stockLine.findFirst({
      where: { locationId, containerId, productId, batchId },
    });
    return Number(stock?.quantityBase ?? 0);
  };

  const validScanPayload = () => ({
    scanSequence: ['container', 'location'],
    scannedContainerId: containerC1Id,
    scannedContainerQr: 'CONT-1',
    scannedLocationId: locationL2Id,
    scannedLocationQr: 'LOC-2',
  });

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
    await seedMovementData();

    adminToken = await login('admin');
    managerToken = await login('manager');
    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Create movement', async () => {
    const res = await createMovement(staffToken, 'MV-T1');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');

    const inDb = await prisma.movement.findUnique({ where: { id: res.body.id } });
    expect(inDb).toBeTruthy();
    expect(inDb?.status).toBe('draft');
  });

  it('Test 2 — Add movement line', async () => {
    const movement = await createMovement(staffToken, 'MV-T2');
    const line = await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 10,
    });

    expect(line.status).toBe(201);
    expect(Number(line.body.quantityBase)).toBeGreaterThan(0);

    const inDb = await prisma.movementLine.findUnique({ where: { id: line.body.id } });
    expect(inDb).toBeTruthy();
    expect(Number(inDb?.quantityBase)).toBe(10);
  });

  it('Test 3 — Submit movement (happy path)', async () => {
    const movement = await createMovement(staffToken, 'MV-T3');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 30,
    });

    const beforeSource = await getStockQty(locationL1Id, containerC1Id);
    const beforeDest = await getStockQty(locationL2Id, containerC1Id);

    const submit = await submitMovement(managerToken, movement.body.id, 'key-1', validScanPayload());

    expect(submit.status).toBe(201);
    expect(submit.body.movement.status).toBe('submitted');

    const afterSource = await getStockQty(locationL1Id, containerC1Id);
    const afterDest = await getStockQty(locationL2Id, containerC1Id);
    expect(afterSource).toBe(beforeSource - 30);
    expect(afterDest).toBe(beforeDest + 30);
    expect(afterSource + afterDest).toBe(beforeSource + beforeDest);
  });

  it('Test 4 — Không cho âm tồn', async () => {
    const movement = await createMovement(staffToken, 'MV-T4');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 150,
    });

    const beforeSource = await getStockQty(locationL1Id, containerC1Id);
    const beforeDest = await getStockQty(locationL2Id, containerC1Id);

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t4', validScanPayload());
    expect(submit.status).toBe(400);

    const afterSource = await getStockQty(locationL1Id, containerC1Id);
    const afterDest = await getStockQty(locationL2Id, containerC1Id);
    expect(afterSource).toBe(beforeSource);
    expect(afterDest).toBe(beforeDest);
  });

  it('Test 5 — Transaction rollback cho movement nhiều line', async () => {
    const movement = await createMovement(staffToken, 'MV-T5');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 20,
    });
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 1000,
    });

    const beforeSource = await getStockQty(locationL1Id, containerC1Id);
    const beforeDest = await getStockQty(locationL2Id, containerC1Id);

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t5', validScanPayload());
    expect(submit.status).toBe(400);

    const afterSource = await getStockQty(locationL1Id, containerC1Id);
    const afterDest = await getStockQty(locationL2Id, containerC1Id);
    expect(afterSource).toBe(beforeSource);
    expect(afterDest).toBe(beforeDest);
  });

  it('Test 6 — Idempotency: submit cùng key không double deduct', async () => {
    const movement = await createMovement(staffToken, 'MV-T6');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 10,
    });

    const first = await submitMovement(managerToken, movement.body.id, 'idem-key-t6', validScanPayload());
    const sourceAfterFirst = await getStockQty(locationL1Id, containerC1Id);
    const destAfterFirst = await getStockQty(locationL2Id, containerC1Id);

    const second = await submitMovement(managerToken, movement.body.id, 'idem-key-t6', validScanPayload());
    const sourceAfterSecond = await getStockQty(locationL1Id, containerC1Id);
    const destAfterSecond = await getStockQty(locationL2Id, containerC1Id);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(sourceAfterSecond).toBe(sourceAfterFirst);
    expect(destAfterSecond).toBe(destAfterFirst);
  });

  it('Test 7 — Idempotency payload mismatch', async () => {
    const movement = await createMovement(staffToken, 'MV-T7');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 10,
    });

    const payloadA = validScanPayload();
    const payloadB = {
      ...validScanPayload(),
      scannedLocationQr: 'LOC-WRONG',
    };

    const first = await submitMovement(managerToken, movement.body.id, 'idem-key-t7', payloadA);
    expect(first.status).toBe(201);

    const second = await submitMovement(managerToken, movement.body.id, 'idem-key-t7', payloadB);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
  });

  it('Test 8 — Container movement', async () => {
    const movement = await createMovement(staffToken, 'MV-T8');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 25,
    });

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t8', validScanPayload());
    expect(submit.status).toBe(201);

    const movedContainer = await prisma.container.findUnique({ where: { id: containerC1Id } });
    expect(movedContainer?.locationId).toBe(locationL2Id);

    const source = await getStockQty(locationL1Id, containerC1Id);
    const destination = await getStockQty(locationL2Id, containerC1Id);
    expect(source).toBe(75);
    expect(destination).toBe(25);
  });

  it('Test 9 — Container vs non-container không merge sai', async () => {
    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL1Id,
        containerId: null,
        quantityBase: '40',
      },
    });

    const movement = await createMovement(staffToken, 'MV-T9');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 20,
    });
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      quantityBase: 10,
    });

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t9', validScanPayload());
    expect(submit.status).toBe(201);

    const destWithContainer = await getStockQty(locationL2Id, containerC1Id);
    const destWithoutContainer = await getStockQty(locationL2Id, null);
    expect(destWithContainer).toBe(20);
    expect(destWithoutContainer).toBe(10);
  });

  it('Test 10 — Scan order sai phải fail INVALID_SCAN_ORDER', async () => {
    const movement = await createMovement(staffToken, 'MV-T10');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 10,
    });

    const invalidOrderPayload = {
      ...validScanPayload(),
      scanSequence: ['location', 'container'],
    };

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t10', invalidOrderPayload);
    expect(submit.status).toBe(400);
    expect(submit.body.error.message).toContain('INVALID_SCAN_ORDER');
  });

  it('Test 11 — Scan mismatch phải fail rõ ràng', async () => {
    const movement = await createMovement(staffToken, 'MV-T11');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 10,
    });

    const mismatchPayload = {
      ...validScanPayload(),
      scannedContainerQr: 'CONT-WRONG',
    };

    const submit = await submitMovement(managerToken, movement.body.id, 'key-t11', mismatchPayload);
    expect(submit.status).toBe(400);
    expect(submit.body.error.message).toContain('INVALID_SCAN_ORDER');
  });

  it('Test 12 — Admin adjustment: chỉ admin gọi được + diff đúng', async () => {
    const managerAdjust = await request(app.getHttpServer())
      .post('/admin/adjustments')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'adj-t12-manager')
      .send({
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL1Id,
        containerId: containerC1Id,
        newQuantityBase: 90,
        reason: 'manager should fail',
      });
    expect(managerAdjust.status).toBe(403);

    const before = await getStockQty(locationL1Id, containerC1Id);
    const adminAdjust = await request(app.getHttpServer())
      .post('/admin/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'adj-t12-admin')
      .send({
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL1Id,
        containerId: containerC1Id,
        newQuantityBase: 80,
        reason: 'stock count correction',
      });

    expect(adminAdjust.status).toBe(201);
    expect(adminAdjust.body.diff).toBe(80 - before);
    const after = await getStockQty(locationL1Id, containerC1Id);
    expect(after).toBe(80);
  });

  it('Test 13 — Admin adjustment không cho âm tồn', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'adj-t13')
      .send({
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL1Id,
        containerId: containerC1Id,
        newQuantityBase: -1,
        reason: 'invalid negative',
      });

    expect(res.status).toBe(400);
  });

  it('Test 14 — Audit đầy đủ và có before/after', async () => {
    const movement = await createMovement(staffToken, 'MV-T14', locationL1Id, locationL2Id, 'audit-create');
    const line = await addMovementLine(
      staffToken,
      movement.body.id,
      {
        productId: productP1Id,
        batchId: batchB1Id,
        containerId: containerC1Id,
        quantityBase: 10,
      },
      'audit-add-line',
    );

    await submitMovement(managerToken, movement.body.id, 'key-t14', validScanPayload(), 'audit-submit');

    await request(app.getHttpServer())
      .post('/admin/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'audit-adjust')
      .send({
        productId: productP1Id,
        batchId: batchB1Id,
        locationId: locationL2Id,
        containerId: containerC1Id,
        newQuantityBase: 15,
        reason: 'audit test adjustment',
      });

    const actions = [
      'CREATE_MOVEMENT',
      'ADD_MOVEMENT_LINE',
      'SUBMIT_MOVEMENT',
      'UPDATE_STOCK_FROM_MOVEMENT',
      'ADMIN_ADJUSTMENT',
    ];
    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: actions },
      },
    });

    expect(events.some((e) => e.action === 'CREATE_MOVEMENT' && e.entityId === movement.body.id)).toBe(true);
    expect(events.some((e) => e.action === 'ADD_MOVEMENT_LINE' && e.entityId === line.body.id)).toBe(true);
    expect(events.some((e) => e.action === 'SUBMIT_MOVEMENT' && e.entityId === movement.body.id)).toBe(true);
    expect(events.some((e) => e.action === 'UPDATE_STOCK_FROM_MOVEMENT')).toBe(true);
    expect(events.some((e) => e.action === 'ADMIN_ADJUSTMENT')).toBe(true);

    for (const event of events) {
      expect(event.actorUserId).toBeTruthy();
      expect(event.correlationId).toBeTruthy();
      if (event.action === 'CREATE_MOVEMENT' || event.action === 'ADD_MOVEMENT_LINE') {
        expect(event.beforeJson).toBeNull();
        expect(event.afterJson).toBeTruthy();
      }
      if (event.action === 'SUBMIT_MOVEMENT' || event.action === 'UPDATE_STOCK_FROM_MOVEMENT') {
        expect(event.beforeJson).toBeTruthy();
        expect(event.afterJson).toBeTruthy();
      }
      if (event.action === 'ADMIN_ADJUSTMENT') {
        expect(event.beforeJson).toBeTruthy();
        expect(event.afterJson).toBeTruthy();
      }
    }
  });

  it('Test 15 — Context propagation: correlation id ở submit movement', async () => {
    const movement = await createMovement(staffToken, 'MV-T15');
    await addMovementLine(staffToken, movement.body.id, {
      productId: productP1Id,
      batchId: batchB1Id,
      containerId: containerC1Id,
      quantityBase: 5,
    });

    const corr = 'move-123';
    const submit = await submitMovement(managerToken, movement.body.id, 'key-t15', validScanPayload(), corr);
    expect(submit.status).toBe(201);

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: 'SUBMIT_MOVEMENT',
        entityId: movement.body.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).toBeTruthy();
    expect(audit?.correlationId).toBe(corr);
  });
});
