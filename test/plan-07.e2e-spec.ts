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

describe('Plan 07 E2E - Reservation & Locking', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let staffUser: User;
  let managerUser: User;
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

    const wh = await prisma.warehouse.create({ data: { code: 'WH-RSV', name: 'Warehouse RSV' } });
    const loc = await prisma.location.create({
      data: { warehouseId: wh.id, code: 'LOC-RSV', name: 'Location RSV' },
    });
    locationId = loc.id;
    const supplier = await prisma.supplier.create({ data: { code: 'S-RSV', name: 'Supplier RSV' } });
    const product = await prisma.product.create({
      data: { code: 'P-RSV', name: 'Product RSV', baseUom: 'unit' },
    });
    productId = product.id;
    const batch = await prisma.batch.create({
      data: {
        productId,
        supplierId: supplier.id,
        lotCode: 'LOT-RSV',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
      },
    });
    batchId = batch.id;
    const container = await prisma.container.create({
      data: { qrCode: 'CONT-RSV', locationId },
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

  const softReserve = async (qty: number, ttlSeconds = 300, token = staffToken, corr = `corr-${qty}`) =>
    request(app.getHttpServer())
      .post('/reservations/soft-reserve')
      .set('Authorization', `Bearer ${token}`)
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
  });

  beforeEach(async () => {
    await resetAllTables();
    await seedData();
    staffToken = await login('staff');
    managerToken = await login('manager');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Không reserve vượt available', async () => {
    const r1 = await softReserve(60);
    expect(r1.status).toBe(201);

    const r2 = await softReserve(41, 300, staffToken, 'corr-over');
    expect(r2.status).toBe(409);
    expect(r2.body.error.message).toContain('RESERVATION_EXCEEDS_AVAILABLE');
  });

  it('Test 2 — Lifecycle soft_reserved -> hard_locked -> released', async () => {
    const soft = await softReserve(10, 600, staffToken, 'corr-life-soft');
    expect(soft.status).toBe(201);
    expect(soft.body.status).toBe('soft_reserved');

    const hard = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-life-hard')
      .send({});
    expect(hard.status).toBe(201);
    expect(hard.body.status).toBe('hard_locked');

    const released = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/release`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-life-release')
      .send({});
    expect(released.status).toBe(201);
    expect(released.body.status).toBe('released');
  });

  it('Test 3 — Không cho hard lock nếu đã expired', async () => {
    const soft = await softReserve(5, 1, staffToken, 'corr-expire-soft');
    expect(soft.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const hard = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-expire-hard')
      .send({});
    expect(hard.status).toBe(409);
    expect(hard.body.error.message).toContain('RESERVATION_EXPIRED');
  });

  it('Test 4 — Activity tracking chỉ update với action hợp lệ', async () => {
    const soft = await softReserve(5, 600, staffToken, 'corr-activity-soft');
    const before = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(before).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/activity`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'corr-activity-ignore')
      .send({ action: 'invalid action' });
    const afterInvalid = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(afterInvalid?.lastActivityAt.getTime()).toBe(before?.lastActivityAt.getTime());

    await new Promise((resolve) => setTimeout(resolve, 30));
    await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/activity`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'corr-activity-valid')
      .send({ action: 'scan QR' });
    const afterValid = await prisma.reservation.findUnique({ where: { id: soft.body.id } });
    expect(afterValid?.lastActivityAt.getTime()).toBeGreaterThan(before!.lastActivityAt.getTime());
  });

  it('Test 5 — Audit bắt buộc cho SOFT_RESERVE, HARD_LOCK, RELEASE_RESERVATION', async () => {
    const soft = await softReserve(7, 600, staffToken, 'corr-audit-soft');
    await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-audit-hard')
      .send({});
    await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/release`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-audit-release')
      .send({});

    const events = await prisma.auditEvent.findMany({
      where: {
        action: {
          in: ['SOFT_RESERVE', 'HARD_LOCK', 'RELEASE_RESERVATION'],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(3);
    for (const e of events) {
      expect(e.actorUserId).toBeTruthy();
      expect(e.correlationId).toBeTruthy();
      expect(e.afterJson).toBeTruthy();
      if (e.action !== 'SOFT_RESERVE') {
        expect(e.beforeJson).toBeTruthy();
      }
    }
  });

  it('Test 6 — Không cho hard lock/release khi reservation đã released', async () => {
    const soft = await softReserve(9, 600, staffToken, 'corr-rel-soft');
    await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/release`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-rel-release')
      .send({});

    const hardAfterRelease = await request(app.getHttpServer())
      .post(`/reservations/${soft.body.id}/hard-lock`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'corr-rel-hard')
      .send({});
    expect(hardAfterRelease.status).toBe(409);
    expect(hardAfterRelease.body.error.message).toContain('RESERVATION_ALREADY_RELEASED');
  });
});
