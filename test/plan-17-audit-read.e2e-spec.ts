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

describe('Plan 17 E2E - Audit read APIs (PR6)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffToken = '';
  let adminToken = '';

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.receipt_lines,
        public.receipts,
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
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@test.local',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    // class-validator IsUUID() 默认校验 UUID v4 格式，确保常量符合 v4：第三组首字符为 "4"
    const entityIdReceiptsA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const entityIdReceiptsB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    const entityIdMovementsA = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

    const older = new Date('2026-01-01T00:00:00.000Z');
    const middle = new Date('2026-02-01T00:00:00.000Z');
    const newest = new Date('2026-03-01T00:00:00.000Z');

    const e1 = await prisma.auditEvent.create({
      data: {
        actorUserId: admin.id,
        action: 'TEST_ACTION_1',
        entityType: 'receipts',
        entityId: entityIdReceiptsA,
        beforeJson: { before: 1 } as any,
        afterJson: { after: 1 } as any,
        reason: 'r1',
        correlationId: 'corr-1',
        createdAt: older,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: staff.id,
        action: 'TEST_ACTION_2',
        entityType: 'movements',
        entityId: entityIdMovementsA,
        reason: null,
        correlationId: 'corr-2',
        createdAt: middle,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: admin.id,
        action: 'TEST_ACTION_3',
        entityType: 'receipts',
        entityId: entityIdReceiptsB,
        afterJson: { after: 3 } as any,
        reason: 'r3',
        correlationId: 'corr-3',
        createdAt: newest,
      },
    });

    // Silence TS unused vars (used in assertions below)
    void e1;

    staffToken = await login('staff');
    adminToken = await login('admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('401 no token', async () => {
    await request(app.getHttpServer()).get('/audit').expect(401);
  });

  it('403 non-admin', async () => {
    await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });

  it('200 admin: pagination meta + sort createdAt desc', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      // 3 条自建 audit_events + 2 条 USER_LOGIN（staff/admin login）
      total: 5,
      totalPages: 3,
    });

    // createdAt desc
    const t0 = new Date(res.body.data[0].createdAt).getTime();
    const t1 = new Date(res.body.data[1].createdAt).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  it('filter by entityType/entityId', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/audit?entityType=receipts&entityId=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].entityType).toBe('receipts');
    expect(res.body.data[0].entityId).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    expect(res.body.data[0].action).toBe('TEST_ACTION_1');
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20, // default from PaginationQueryDto
      total: 1,
      totalPages: 1,
    });
  });

  it('filter by date range', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/audit?createdFrom=2026-02-15T00:00:00.000Z&createdTo=2026-03-15T00:00:00.000Z',
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].entityType).toBe('receipts');
    expect(res.body.data[0].action).toBe('TEST_ACTION_3');
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

