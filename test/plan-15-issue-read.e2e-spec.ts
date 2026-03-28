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

describe('Plan 15 E2E - Issues read APIs + pick-tasks query (PR4)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffToken = '';

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.pick_tasks,
        public.issue_lines,
        public.issues,
        public.products,
        public.batches,
        public.locations,
        public.warehouses,
        public.reservations,
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
    const location = await prisma.location.create({ data: { warehouseId: warehouse.id, code: 'LOC-01', name: 'Location 01' } });
    const product = await prisma.product.create({ data: { code: 'P-01', name: 'Product 01', baseUom: 'kg' } });
    const batch = await prisma.batch.create({
      data: {
        productId: product.id,
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
        lotCode: 'LOT-001',
      },
    });

    const issue1 = await prisma.issue.create({
      data: {
        code: 'ISS-001',
        status: 'draft',
        createdBy: staff.id,
      },
    });

    const issue2 = await prisma.issue.create({
      data: {
        code: 'ISS-002',
        status: 'planned',
        createdBy: staff.id,
      },
    });

    const line = await prisma.issueLine.create({
      data: {
        issueId: issue2.id,
        productId: product.id,
        quantityBase: 15,
      },
    });

    await prisma.pickTask.create({
      data: {
        issueLineId: line.id,
        productId: product.id,
        batchId: batch.id,
        locationId: location.id,
        quantityBase: 10,
        pickedQuantity: 0,
        status: 'pending',
      },
    });

    await prisma.pickTask.create({
      data: {
        issueLineId: line.id,
        productId: product.id,
        batchId: batch.id,
        locationId: location.id,
        quantityBase: 5,
        pickedQuantity: 0,
        status: 'pending',
      },
    });

    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-02-01T00:00:00.000Z');
    await prisma.issue.update({ where: { id: issue1.id }, data: { createdAt: older } });
    await prisma.issue.update({ where: { id: issue2.id }, data: { createdAt: newer } });

    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /issues returns pagination meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/issues?page=1&limit=1')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('GET /issues filters by status/date range', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/issues?status=planned')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].status).toBe('planned');

    const byDate = await request(app.getHttpServer())
      .get('/issues?createdFrom=2026-01-15T00:00:00.000Z&createdTo=2026-02-15T00:00:00.000Z')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(byDate.body.data).toHaveLength(1);
    expect(byDate.body.data[0].code).toBe('ISS-002');
  });

  it('GET /issues/:id success and 404', async () => {
    const issue = await prisma.issue.findFirstOrThrow({ where: { code: 'ISS-002' } });

    const ok = await request(app.getHttpServer())
      .get(`/issues/${issue.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(ok.body.id).toBe(issue.id);
    expect(Array.isArray(ok.body.lines)).toBe(true);

    await request(app.getHttpServer())
      .get('/issues/2f1b20ee-1f9a-4c39-bf84-6de0542c2ddd')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('GET /issues/:id/pick-tasks returns list + meta', async () => {
    const issue = await prisma.issue.findFirstOrThrow({ where: { code: 'ISS-002' } });

    const res = await request(app.getHttpServer())
      .get(`/issues/${issue.id}/pick-tasks?page=1&limit=10&status=pending`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });

  it('401 no token', async () => {
    await request(app.getHttpServer()).get('/issues').expect(401);
  });
});
