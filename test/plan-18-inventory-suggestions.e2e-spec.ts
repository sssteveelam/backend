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

describe('Plan 18 E2E - Inventory Suggestions (PR7)', () => {
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
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });
    prisma = new PrismaClient();
    await prisma.$connect();

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  let productId = '';
  let warehouseId = '';

  beforeEach(async () => {
    await resetAllTables();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
    });
    staffToken = await login('staff');

    const wh = await prisma.warehouse.create({ data: { code: 'WH-01', name: 'Main' } });
    warehouseId = wh.id;
    const loc1 = await prisma.location.create({ data: { code: 'A-01', name: 'Bin A1', warehouseId: wh.id } });
    const loc2 = await prisma.location.create({ data: { code: 'A-02', name: 'Bin A2', warehouseId: wh.id } });
    
    const prod = await prisma.product.create({ data: { code: 'P01', name: 'Product 1', baseUom: 'EA' } });
    productId = prod.id;

    // FEFO: exp1 < exp2 < exp3
    const exp1 = new Date('2026-06-01');
    const exp2 = new Date('2026-07-01');
    const exp3 = new Date('2026-08-01');

    const b1 = await prisma.batch.create({ data: { productId: prod.id, lotCode: 'L1', expiryDate: exp1, manufactureDate: new Date('2025-01-01') } });
    const b2 = await prisma.batch.create({ data: { productId: prod.id, lotCode: 'L2', expiryDate: exp2, manufactureDate: new Date('2025-01-01') } });
    const b3 = await prisma.batch.create({ data: { productId: prod.id, lotCode: 'L3', expiryDate: exp3, manufactureDate: new Date('2025-01-01') } });

    // Stock
    await prisma.stockLine.create({ data: { productId: prod.id, batchId: b3.id, locationId: loc1.id, quantityBase: 50 } }); // Oldest expiry, location 1
    await prisma.stockLine.create({ data: { productId: prod.id, batchId: b2.id, locationId: loc2.id, quantityBase: 100 } }); // Middle expiry
    await prisma.stockLine.create({ data: { productId: prod.id, batchId: b1.id, locationId: loc1.id, quantityBase: 20 } }); // Earliest expiry
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('401 no token', async () => {
    await request(app.getHttpServer()).get('/inventory/suggestions').expect(401);
  });

  it('200: FEFO sorting (earliest first)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/inventory/suggestions?productId=${productId}`)
      .set('Authorization', `Staff ${staffToken}`) // Wait, the project usually uses 'Bearer' or 'StaffToken'? 
      // Checking plan-17 it uses Bearer.
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions[0].batchLotCode).toBe('L1'); // 2026-06-01
    expect(res.body.suggestions[1].batchLotCode).toBe('L2'); // 2026-07-01
    expect(res.body.suggestions[2].batchLotCode).toBe('L3'); // 2026-08-01
    expect(res.body.basis).toBe('FEFO');
  });

  it('filter by warehouseId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/inventory/suggestions?productId=${productId}&warehouseId=${warehouseId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it('limit cap 50', async () => {
    await request(app.getHttpServer())
      .get(`/inventory/suggestions?productId=${productId}&limit=51`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400); // class-validator Max(50)
  });
});
