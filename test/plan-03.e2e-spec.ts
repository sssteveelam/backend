import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { BatchService } from '../src/modules/inventory/services/batch.service';

dotenv.config({ path: '.env.test' });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for e2e tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

describe('Plan 03 E2E - Core Inventory', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let batchService: BatchService;

  let adminUser: User;
  let managerUser: User;
  let staffUser: User;

  let adminToken: string;
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
    const warehouse = await prisma.warehouse.create({
      data: { code: 'WH-A', name: 'Warehouse A' },
    });
    warehouseAId = warehouse.id;

    const location = await prisma.location.create({
      data: {
        warehouseId: warehouseAId,
        code: 'LOC-1',
        name: 'Location L1',
      },
    });
    locationL1Id = location.id;

    const supplier = await prisma.supplier.create({
      data: { code: 'S1', name: 'Supplier S1' },
    });
    supplierS1Id = supplier.id;

    const product = await prisma.product.create({
      data: { code: 'P1', name: 'Product P1', baseUom: 'kg' },
    });
    productP1Id = product.id;
  };

  const login = async (usernameOrEmail: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail,
      password: plainPassword,
    });

    return res.body.accessToken as string;
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

    batchService = app.get(BatchService);
  });

  beforeEach(async () => {
    await resetAllTables();
    await seedUsers();
    await seedMasterData();

    adminToken = await login('admin');
    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Batch identity', async () => {
    const manufactureDate = new Date('2026-01-01');
    const expiryDate = new Date('2026-12-01');

    const batchId1 = await batchService.getOrCreateBatchId({
      actorUserId: adminUser.id,
      productId: productP1Id,
      supplierId: supplierS1Id,
      manufactureDate,
      expiryDate,
      lotCode: 'LOT-001',
    });

    const batchId2 = await batchService.getOrCreateBatchId({
      actorUserId: adminUser.id,
      productId: productP1Id,
      supplierId: supplierS1Id,
      manufactureDate,
      expiryDate,
      lotCode: 'LOT-001',
    });

    expect(batchId1).toBe(batchId2);

    const rows = await prisma.batch.findMany({
      where: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        manufactureDate,
        expiryDate,
        lotCode: 'LOT-001',
      },
    });

    expect(rows).toHaveLength(1);
  });

  it('Test 2 — Batch validation', async () => {
    const beforeCount = await prisma.batch.count();

    await expect(
      batchService.getOrCreateBatchId({
        actorUserId: adminUser.id,
        productId: productP1Id,
        supplierId: supplierS1Id,
        manufactureDate: new Date('2026-05-01'),
        expiryDate: new Date('2026-05-01'),
        lotCode: 'LOT-BAD',
      }),
    ).rejects.toThrow();

    const afterCount = await prisma.batch.count();
    expect(afterCount).toBe(beforeCount);
  });

  it('Test 3 — Batch uniqueness theo 5 fields', async () => {
    await batchService.getOrCreateBatchId({
      actorUserId: adminUser.id,
      productId: productP1Id,
      supplierId: supplierS1Id,
      manufactureDate: new Date('2026-01-01'),
      expiryDate: new Date('2026-12-01'),
      lotCode: 'LOT-A',
    });

    await batchService.getOrCreateBatchId({
      actorUserId: adminUser.id,
      productId: productP1Id,
      supplierId: supplierS1Id,
      manufactureDate: new Date('2026-01-01'),
      expiryDate: new Date('2026-11-01'),
      lotCode: 'LOT-B',
    });

    const count = await prisma.batch.count();
    expect(count).toBe(2);
  });

  it('Test 4 — Inventory query basic', async () => {
    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-I1',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-10-01'),
      },
    });

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batch.id,
        locationId: locationL1Id,
        quantityBase: '100',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'inv-basic');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].product.id).toBe(productP1Id);
    expect(res.body[0].batch.id).toBe(batch.id);
    expect(res.body[0].location.id).toBe(locationL1Id);
    expect(Number(res.body[0].quantityBase)).toBe(100);
  });

  it('Test 5 — Inventory theo container vs rời', async () => {
    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-I2',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-10-01'),
      },
    });

    const container = await prisma.container.create({
      data: {
        qrCode: 'CONT-MIX-1',
        locationId: locationL1Id,
      },
    });

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batch.id,
        locationId: locationL1Id,
        containerId: container.id,
        quantityBase: '40',
      },
    });

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batch.id,
        locationId: locationL1Id,
        containerId: null,
        quantityBase: '60',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'inv-mix');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const withContainer = res.body.find((x: { container: { qrCode: string } | null }) => x.container);
    const loose = res.body.find((x: { container: { qrCode: string } | null }) => x.container === null);

    expect(withContainer).toBeTruthy();
    expect(withContainer.container.qrCode).toBe('CONT-MIX-1');
    expect(loose).toBeTruthy();
    expect(loose.container).toBeNull();
  });

  it('Test 6 — Near-expiry', async () => {
    const now = new Date();
    const in5days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const batchNear = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-NEAR',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: in5days,
      },
    });

    const batchFar = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-FAR',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: in30days,
      },
    });

    await prisma.stockLine.createMany({
      data: [
        {
          productId: productP1Id,
          batchId: batchNear.id,
          locationId: locationL1Id,
          quantityBase: '10',
        },
        {
          productId: productP1Id,
          batchId: batchFar.id,
          locationId: locationL1Id,
          quantityBase: '20',
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/inventory/near-expiry?days=7')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'near-expiry');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].batch.lotCode).toBe('LOT-NEAR');

    if (res.body.length > 1) {
      const expiries = res.body.map((x: { batch: { expiryDate: string } }) =>
        new Date(x.batch.expiryDate).getTime(),
      );
      for (let i = 1; i < expiries.length; i += 1) {
        expect(expiries[i]).toBeGreaterThanOrEqual(expiries[i - 1]);
      }
    }
  });

  it('Test 7 — Container lookup', async () => {
    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-CONT',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
      },
    });

    const container = await prisma.container.create({
      data: {
        qrCode: 'CONT-1',
        locationId: locationL1Id,
      },
    });

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batch.id,
        locationId: locationL1Id,
        containerId: container.id,
        quantityBase: '25',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/containers/CONT-1')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cont-lookup');

    expect(res.status).toBe(200);
    expect(res.body.qrCode).toBe('CONT-1');
    expect(res.body.locationId).toBe(locationL1Id);
    expect(res.body.stockLines).toHaveLength(1);
    expect(Number(res.body.stockLines[0].quantityBase)).toBe(25);
  });

  it('Test 8 — Location lookup', async () => {
    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-LOC',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
      },
    });

    await prisma.stockLine.createMany({
      data: [
        {
          productId: productP1Id,
          batchId: batch.id,
          locationId: locationL1Id,
          quantityBase: '11',
        },
        {
          productId: productP1Id,
          batchId: batch.id,
          locationId: locationL1Id,
          quantityBase: '22',
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/locations/LOC-1')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'loc-lookup');

    expect(res.status).toBe(200);
    expect(res.body.location.code).toBe('LOC-1');
    expect(res.body.inventory).toHaveLength(2);
  });

  it('Test 9 — RBAC', async () => {
    const staffRes = await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'rbac-staff');

    expect(staffRes.status).toBe(200);

    const noTokenRes = await request(app.getHttpServer())
      .get('/inventory')
      .set('x-correlation-id', 'rbac-none');

    expect(noTokenRes.status).toBe(401);
  });

  it('Test 10 — Audit', async () => {
    const batch = await prisma.batch.create({
      data: {
        productId: productP1Id,
        supplierId: supplierS1Id,
        lotCode: 'LOT-AUD',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
      },
    });

    const container = await prisma.container.create({
      data: {
        qrCode: 'CONT-AUD',
        locationId: locationL1Id,
      },
    });

    await prisma.stockLine.create({
      data: {
        productId: productP1Id,
        batchId: batch.id,
        locationId: locationL1Id,
        containerId: container.id,
        quantityBase: '15',
      },
    });

    await request(app.getHttpServer())
      .get('/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'audit-batches');

    await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'audit-inventory');

    await request(app.getHttpServer())
      .get('/containers/CONT-AUD')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'audit-container');

    await request(app.getHttpServer())
      .get('/locations/LOC-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'audit-location');

    const actions = ['VIEW_BATCHES', 'VIEW_INVENTORY', 'VIEW_CONTAINER', 'VIEW_LOCATION'];
    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: actions },
        actorUserId: adminUser.id,
      },
    });

    const eventActions = new Set(events.map((e) => e.action));
    expect(eventActions.has('VIEW_BATCHES')).toBe(true);
    expect(eventActions.has('VIEW_INVENTORY')).toBe(true);
    expect(eventActions.has('VIEW_CONTAINER')).toBe(true);
    expect(eventActions.has('VIEW_LOCATION')).toBe(true);

    const batchAudit = events.find((e) => e.action === 'VIEW_BATCHES');
    const inventoryAudit = events.find((e) => e.action === 'VIEW_INVENTORY' && e.correlationId === 'audit-inventory');
    const containerAudit = events.find((e) => e.action === 'VIEW_CONTAINER');
    const locationAudit = events.find((e) => e.action === 'VIEW_LOCATION');

    expect(batchAudit?.actorUserId).toBe(adminUser.id);
    expect(containerAudit?.actorUserId).toBe(adminUser.id);
    expect(locationAudit?.actorUserId).toBe(adminUser.id);
    expect(inventoryAudit?.correlationId).toBe('audit-inventory');
  });

  it('Test 11 — Context propagation', async () => {
    await request(app.getHttpServer())
      .get('/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'test-999');

    const event = await prisma.auditEvent.findFirst({
      where: {
        action: 'VIEW_INVENTORY',
        actorUserId: adminUser.id,
        correlationId: 'test-999',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(event).toBeTruthy();
    expect(event?.correlationId).toBe('test-999');
  });
});
