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

describe('Plan 13 E2E - Receipts read APIs (PR2)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let staffToken = '';

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

    const supplierA = await prisma.supplier.create({ data: { code: 'SUP-A', name: 'Supplier A' } });
    const supplierB = await prisma.supplier.create({ data: { code: 'SUP-B', name: 'Supplier B' } });

    const warehouseA = await prisma.warehouse.create({ data: { code: 'WH-A', name: 'Warehouse A' } });
    const warehouseB = await prisma.warehouse.create({ data: { code: 'WH-B', name: 'Warehouse B' } });

    const product = await prisma.product.create({
      data: { code: 'P-01', name: 'Product 01', baseUom: 'kg' },
    });

    const r1 = await prisma.receipt.create({
      data: {
        code: 'RCPT-001',
        supplierId: supplierA.id,
        warehouseId: warehouseA.id,
        status: 'draft',
        totalValue: 100,
        createdBy: staff.id,
      },
    });

    const r2 = await prisma.receipt.create({
      data: {
        code: 'RCPT-002',
        supplierId: supplierB.id,
        warehouseId: warehouseA.id,
        status: 'submitted',
        totalValue: 200,
        createdBy: staff.id,
      },
    });

    await prisma.receipt.create({
      data: {
        code: 'RCPT-003',
        supplierId: supplierA.id,
        warehouseId: warehouseB.id,
        status: 'cancelled',
        totalValue: 300,
        createdBy: staff.id,
      },
    });

    await prisma.receiptLine.create({
      data: {
        receiptId: r2.id,
        productId: product.id,
        supplierId: supplierB.id,
        quantity: 10,
        quantityBase: 10,
        uom: 'kg',
        unitCost: 20,
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-01'),
        lotCode: 'LOT-001',
      },
    });

    await prisma.receiptLine.create({
      data: {
        receiptId: r2.id,
        productId: product.id,
        supplierId: supplierB.id,
        quantity: 5,
        quantityBase: 5,
        uom: 'kg',
        unitCost: 22,
        manufactureDate: new Date('2026-02-01'),
        expiryDate: new Date('2026-11-01'),
        lotCode: 'LOT-002',
      },
    });

    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-02-01T00:00:00.000Z');
    await prisma.receipt.update({ where: { id: r1.id }, data: { createdAt: older } });
    await prisma.receipt.update({ where: { id: r2.id }, data: { createdAt: newer } });

    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('list returns meta + pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/receipts?page=1&limit=2')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('list filters by status/code/date range', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/receipts?status=submitted')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].status).toBe('submitted');

    const byCode = await request(app.getHttpServer())
      .get('/receipts?code=002')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(byCode.body.data).toHaveLength(1);
    expect(byCode.body.data[0].code).toBe('RCPT-002');

    const byDate = await request(app.getHttpServer())
      .get('/receipts?createdFrom=2026-01-15T00:00:00.000Z&createdTo=2026-02-15T00:00:00.000Z')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(byDate.body.data).toHaveLength(1);
    expect(byDate.body.data[0].code).toBe('RCPT-002');
  });

  it('detail returns lines', async () => {
    const submitted = await prisma.receipt.findFirstOrThrow({ where: { code: 'RCPT-002' } });

    const res = await request(app.getHttpServer())
      .get(`/receipts/${submitted.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.id).toBe(submitted.id);
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines).toHaveLength(2);
  });

  it('detail 404 if not found', async () => {
    await request(app.getHttpServer())
      .get('/receipts/2f1b20ee-1f9a-4c39-bf84-6de0542c2ddd')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('401 without token', async () => {
    await request(app.getHttpServer()).get('/receipts').expect(401);
  });
});
