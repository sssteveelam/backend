import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { ReservationTimeoutService } from '../src/modules/reservation/reservation-timeout.service';

dotenv.config({ path: '.env.test' });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for e2e tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.RESERVATION_WORKER_ENABLED = 'false';

describe('Plan 08 E2E - Reservation auto-release worker + config', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let reservationTimeoutService: ReservationTimeoutService;

  let adminUser: User;
  let staffUser: User;
  let managerUser: User;
  let adminToken: string;
  let staffToken: string;
  let managerToken: string;

  let locationId: string;
  let productId: string;
  let batchId: string;
  let containerId: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.reservations,
        public.app_timeout_config,
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

  const login = async (usernameOrEmail: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail, password: plainPassword });
    return res.body.accessToken as string;
  };

  const seedData = async () => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    adminUser = await prisma.user.create({
      data: { username: 'admin', email: 'admin@test.local', passwordHash, role: 'admin', status: 'active' },
    });
    staffUser = await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
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

    const wh = await prisma.warehouse.create({ data: { code: 'WH-P08', name: 'Warehouse P08' } });
    const loc = await prisma.location.create({
      data: { warehouseId: wh.id, code: 'LOC-P08', name: 'Location P08' },
    });
    locationId = loc.id;
    const supplier = await prisma.supplier.create({ data: { code: 'S-P08', name: 'Supplier P08' } });
    const product = await prisma.product.create({
      data: { code: 'P-P08', name: 'Product P08', baseUom: 'unit' },
    });
    productId = product.id;
    const batch = await prisma.batch.create({
      data: {
        productId,
        supplierId: supplier.id,
        lotCode: 'LOT-P08',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
      },
    });
    batchId = batch.id;
    const container = await prisma.container.create({
      data: { qrCode: 'CONT-P08', locationId },
    });
    containerId = container.id;
    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId,
        containerId,
        quantityBase: 100,
      },
    });
  };

  const softReserve = (qty: number, ttlSeconds: number, corr: string) =>
    request(app.getHttpServer())
      .post('/reservations/soft-reserve')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', corr)
      .send({
        productId,
        batchId,
        locationId,
        containerId,
        quantityBase: qty,
        ttlSeconds,
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
    reservationTimeoutService = app.get(ReservationTimeoutService);
  });

  beforeEach(async () => {
    await resetAllTables();
    await seedData();
    adminToken = await login('admin');
    staffToken = await login('staff');
    managerToken = await login('manager');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /config/timeouts — trả về giá trị (tạo default nếu thiếu)', async () => {
    const res = await request(app.getHttpServer())
      .get('/config/timeouts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cfg-get');
    expect(res.status).toBe(200);
    expect(res.body.softReserveMinutes).toBeGreaterThan(0);
    expect(res.body.hardLockMinutes).toBeGreaterThan(0);
    expect(res.body.softReserveMinutes).toBeLessThanOrEqual(1440);
    expect(res.body.hardLockMinutes).toBeLessThanOrEqual(1440);
  });

  it('PUT /config/timeouts — admin cập nhật; staff bị 403', async () => {
    const denied = await request(app.getHttpServer())
      .put('/config/timeouts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cfg-deny')
      .send({ softReserveMinutes: 15, hardLockMinutes: 20 });
    expect(denied.status).toBe(403);

    const ok = await request(app.getHttpServer())
      .put('/config/timeouts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'cfg-ok')
      .send({ softReserveMinutes: 45, hardLockMinutes: 90 });
    expect(ok.status).toBe(200);
    expect(ok.body.softReserveMinutes).toBe(45);
    expect(ok.body.hardLockMinutes).toBe(90);

    const row = await prisma.appTimeoutConfig.findUnique({ where: { id: 'default' } });
    expect(row?.softReserveMinutes).toBe(45);
    expect(row?.hardLockMinutes).toBe(90);
  });

  it('Worker — soft_reserved hết hạn → released + audit AUTO_RELEASE_SOFT_RESERVATION', async () => {
    await prisma.appTimeoutConfig.create({
      data: { id: 'default', softReserveMinutes: 30, hardLockMinutes: 60 },
    });

    const soft = await softReserve(5, 1, 'soft-exp');
    expect(soft.status).toBe(201);
    await new Promise((r) => setTimeout(r, 1500));

    const result = await reservationTimeoutService.runAutoReleaseCycle();
    expect(result.softReleased).toBeGreaterThanOrEqual(1);

    const row = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(row?.status).toBe('released');

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'AUTO_RELEASE_SOFT_RESERVATION', entityId: soft.body.id },
    });
    expect(audit).toBeTruthy();
    expect(audit?.actorUserId).toBeTruthy();
    expect(audit?.correlationId).toBe(result.correlationId);
    expect(audit?.beforeJson).toBeTruthy();
    expect(audit?.afterJson).toBeTruthy();
  });

  it('Worker — hard_locked không hoạt động → released (policy A) + audit', async () => {
    await prisma.appTimeoutConfig.create({
      data: { id: 'default', softReserveMinutes: 30, hardLockMinutes: 5 },
    });

    const soft = await softReserve(3, 600, 'hard-inact-soft');
    expect(soft.status).toBe(201);
    const hard = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'hard-inact-lock')
      .send({});
    expect(hard.status).toBe(201);

    const stale = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.reservation.update({
      where: { id: soft.body.id },
      data: { lastActivityAt: stale },
    });

    const result = await reservationTimeoutService.runAutoReleaseCycle();
    expect(result.hardReleased).toBeGreaterThanOrEqual(1);

    const row = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(row?.status).toBe('released');

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'AUTO_RELEASE_HARD_LOCK', entityId: soft.body.id },
    });
    expect(audit).toBeTruthy();
    expect(audit?.beforeJson).toBeTruthy();
    expect(audit?.afterJson).toBeTruthy();
  });

  it('Worker — hard_locked còn activity gần → không auto-release', async () => {
    await prisma.appTimeoutConfig.create({
      data: { id: 'default', softReserveMinutes: 30, hardLockMinutes: 60 },
    });

    const soft = await softReserve(2, 600, 'hard-active-soft');
    expect(soft.status).toBe(201);
    const hard = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'hard-active-lock')
      .send({});
    expect(hard.status).toBe(201);

    await prisma.reservation.update({
      where: { id: soft.body.id },
      data: { lastActivityAt: new Date() },
    });

    const result = await reservationTimeoutService.runAutoReleaseCycle();
    expect(result.hardReleased).toBe(0);

    const row = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(row?.status).toBe('hard_locked');
  });
});
