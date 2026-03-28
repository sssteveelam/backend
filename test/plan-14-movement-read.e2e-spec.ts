import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
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

describe('Plan 14 E2E - Movements read APIs (PR3)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffToken = '';

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.movement_lines,
        public.movements,
        public.locations,
        public.warehouses,
        public.products,
        public.batches,
        public.containers,
        public.stock_lines,
        public.idempotency_keys,
        public.audit_events,
        public.users
      CASCADE;
    `);
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
  });

  beforeEach(async () => {
    await resetAllTables();

    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const staff = await prisma.user.create({
      data: {
        username: 'staff',
        email: 'staff@test.local',
        passwordHash,
        role: 'staff',
        status: 'active',
      },
    });

    const warehouse = await prisma.warehouse.create({ data: { code: 'WH-A', name: 'Warehouse A' } });
    const locA = await prisma.location.create({ data: { warehouseId: warehouse.id, code: 'L-A', name: 'Location A' } });
    const locB = await prisma.location.create({ data: { warehouseId: warehouse.id, code: 'L-B', name: 'Location B' } });

    const m1 = await prisma.movement.create({
      data: {
        code: 'MV-001',
        fromLocationId: locA.id,
        toLocationId: locB.id,
        status: 'draft',
        createdBy: staff.id,
      },
    });

    const m2 = await prisma.movement.create({
      data: {
        code: 'MV-002',
        fromLocationId: locB.id,
        toLocationId: locA.id,
        status: 'submitted',
        createdBy: staff.id,
      },
    });

    const product = await prisma.product.create({ data: { code: 'P-01', name: 'Product 01', baseUom: 'kg' } });
    const batch = await prisma.batch.create({
      data: {
        productId: product.id,
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
        lotCode: 'LOT-001',
      },
    });

    await prisma.movementLine.create({
      data: {
        movementId: m2.id,
        productId: product.id,
        batchId: batch.id,
        quantityBase: 10,
      },
    });

    await prisma.movementLine.create({
      data: {
        movementId: m2.id,
        productId: product.id,
        batchId: batch.id,
        quantityBase: 5,
      },
    });

    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-02-01T00:00:00.000Z');
    await prisma.movement.update({ where: { id: m1.id }, data: { createdAt: older } });
    await prisma.movement.update({ where: { id: m2.id }, data: { createdAt: newer } });

    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('list returns meta + pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/movements?page=1&limit=1')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('list filters by status/date range', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/movements?status=submitted')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].status).toBe('submitted');

    const byDate = await request(app.getHttpServer())
      .get('/movements?createdFrom=2026-01-15T00:00:00.000Z&createdTo=2026-02-15T00:00:00.000Z')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(byDate.body.data).toHaveLength(1);
    expect(byDate.body.data[0].code).toBe('MV-002');
  });

  it('detail includes lines', async () => {
    const movement = await prisma.movement.findFirstOrThrow({ where: { code: 'MV-002' } });
    const res = await request(app.getHttpServer())
      .get(`/movements/${movement.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.id).toBe(movement.id);
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines).toHaveLength(2);
  });

  it('detail returns 404', async () => {
    await request(app.getHttpServer())
      .get('/movements/2f1b20ee-1f9a-4c39-bf84-6de0542c2ddd')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('401 without token', async () => {
    await request(app.getHttpServer()).get('/movements').expect(401);
  });
});
