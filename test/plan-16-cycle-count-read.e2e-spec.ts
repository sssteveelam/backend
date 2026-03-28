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

describe('Plan 16 E2E - Cycle counts read APIs (PR5)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffToken = '';
  let locAId = '';
  let locBId = '';

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.cycle_count_lines,
        public.cycle_counts,
        public.products,
        public.batches,
        public.locations,
        public.warehouses,
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
    const locA = await prisma.location.create({
      data: { warehouseId: warehouse.id, code: 'LOC-A', name: 'Location A' },
    });
    const locB = await prisma.location.create({
      data: { warehouseId: warehouse.id, code: 'LOC-B', name: 'Location B' },
    });
    locAId = locA.id;
    locBId = locB.id;

    const product = await prisma.product.create({ data: { code: 'P-01', name: 'Product 01', baseUom: 'kg' } });
    const batch = await prisma.batch.create({
      data: {
        productId: product.id,
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
        lotCode: 'LOT-001',
      },
    });

    const c1 = await prisma.cycleCount.create({
      data: {
        code: 'CC-001',
        status: 'draft',
        locationId: locA.id,
        createdBy: staff.id,
      },
    });
    const c2 = await prisma.cycleCount.create({
      data: {
        code: 'CC-002',
        status: 'submitted',
        locationId: locA.id,
        createdBy: staff.id,
      },
    });
    const c3 = await prisma.cycleCount.create({
      data: {
        code: 'CC-003',
        status: 'submitted',
        locationId: locB.id,
        createdBy: staff.id,
      },
    });

    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-02-01T00:00:00.000Z');
    const newest = new Date('2026-03-01T00:00:00.000Z');
    await prisma.cycleCount.update({ where: { id: c1.id }, data: { createdAt: older } });
    await prisma.cycleCount.update({ where: { id: c2.id }, data: { createdAt: newer } });
    await prisma.cycleCount.update({ where: { id: c3.id }, data: { createdAt: newest } });

    // c1: 1 line
    await prisma.cycleCountLine.create({
      data: {
        cycleCountId: c1.id,
        productId: product.id,
        batchId: batch.id,
        countedQuantity: 7,
      },
    });

    // c2: 2 lines (created_at ascending order assertion)
    const l1 = await prisma.cycleCountLine.create({
      data: {
        cycleCountId: c2.id,
        productId: product.id,
        batchId: batch.id,
        countedQuantity: 10,
      },
    });
    const l2 = await prisma.cycleCountLine.create({
      data: {
        cycleCountId: c2.id,
        productId: product.id,
        batchId: batch.id,
        countedQuantity: 5,
      },
    });
    const lineOlder = new Date('2026-02-01T01:00:00.000Z');
    const lineNewer = new Date('2026-02-02T01:00:00.000Z');
    await prisma.cycleCountLine.update({ where: { id: l1.id }, data: { createdAt: lineOlder } });
    await prisma.cycleCountLine.update({ where: { id: l2.id }, data: { createdAt: lineNewer } });

    // c3: 1 line
    await prisma.cycleCountLine.create({
      data: {
        cycleCountId: c3.id,
        productId: product.id,
        batchId: batch.id,
        countedQuantity: 9,
      },
    });

    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /cycle-counts returns pagination meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/cycle-counts?page=1&limit=2')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('GET /cycle-counts filters by status/date range/locationId', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/cycle-counts?status=submitted')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(byStatus.body.data).toHaveLength(2);
    expect(byStatus.body.data[0].status).toBe('submitted');

    const byLocation = await request(app.getHttpServer())
      .get(`/cycle-counts?locationId=${locAId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(byLocation.body.data).toHaveLength(2);
    expect(byLocation.body.data.map((x: any) => x.code)).toEqual(['CC-002', 'CC-001']);
  });

  it('GET /cycle-counts filter - date range', async () => {
    const byDate = await request(app.getHttpServer())
      .get('/cycle-counts?createdFrom=2026-01-15T00:00:00.000Z&createdTo=2026-02-15T00:00:00.000Z')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(byDate.body.data).toHaveLength(1);
    expect(byDate.body.data[0].code).toBe('CC-002');
  });

  it('GET /cycle-counts/:id includes lines', async () => {
    const cycleCount = await prisma.cycleCount.findFirstOrThrow({ where: { code: 'CC-002' } });

    const res = await request(app.getHttpServer())
      .get(`/cycle-counts/${cycleCount.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.id).toBe(cycleCount.id);
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines).toHaveLength(2);

    const firstLine = await prisma.cycleCountLine.findFirstOrThrow({
      where: { cycleCountId: cycleCount.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(res.body.lines[0].id).toBe(firstLine.id);
  });

  it('GET /cycle-counts/:id 404 if not found', async () => {
    await request(app.getHttpServer())
      .get('/cycle-counts/2f1b20ee-1f9a-4c39-bf84-6de0542c2ddd')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('401 no token', async () => {
    await request(app.getHttpServer()).get('/cycle-counts').expect(401);
  });
});

