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

describe('Plan 19 E2E - Pick-Task Suggestions (PR7)', () => {
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

  let taskWithContainerId = '';
  let taskWithoutContainerId = '';

  beforeEach(async () => {
    await resetAllTables();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const staff = await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
    });
    staffToken = await login('staff');

    const wh = await prisma.warehouse.create({ data: { code: 'WH-01', name: 'Main' } });
    const loc = await prisma.location.create({ data: { code: 'L-01', name: 'Bin 1', warehouseId: wh.id } });
    const cont = await prisma.container.create({ data: { qrCode: 'C-01', locationId: loc.id } });
    
    const prod = await prisma.product.create({ data: { code: 'P01', name: 'Product 1', baseUom: 'EA' } });
    const batch = await prisma.batch.create({ data: { productId: prod.id, lotCode: 'LOT-1', expiryDate: new Date('2026-01-01'), manufactureDate: new Date('2025-01-01') } });

    const issue = await prisma.issue.create({ data: { code: 'ISS-001', status: 'picking', createdBy: staff.id } });
    const line = await prisma.issueLine.create({ data: { issueId: issue.id, productId: prod.id, quantityBase: 10 } });

    const t1 = await prisma.pickTask.create({
      data: {
        issueLineId: line.id, productId: prod.id, batchId: batch.id, locationId: loc.id, containerId: cont.id,
        quantityBase: 5, pickedQuantity: 0, status: 'pending'
      }
    });
    taskWithContainerId = t1.id;

    const t2 = await prisma.pickTask.create({
      data: {
        issueLineId: line.id, productId: prod.id, batchId: batch.id, locationId: loc.id, containerId: null,
        quantityBase: 5, pickedQuantity: 0, status: 'pending'
      }
    });
    taskWithoutContainerId = t2.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('401 no token', async () => {
    await request(app.getHttpServer()).get(`/pick-tasks/${taskWithContainerId}/suggestions`).expect(401);
  });

  it('404 pick task not found', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000000';
    await request(app.getHttpServer())
      .get(`/pick-tasks/${fakeId}/suggestions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('200: task with container -> sequence [location, container]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/pick-tasks/${taskWithContainerId}/suggestions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.scanSequenceRecommended).toEqual(['location', 'container']);
    expect(res.body.expected.containerQrCode).toBe('C-01');
    expect(res.body.hints.requiresContainerScan).toBe(true);
  });

  it('200: task without container -> sequence [location]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/pick-tasks/${taskWithoutContainerId}/suggestions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(res.body.scanSequenceRecommended).toEqual(['location']);
    expect(res.body.expected.containerQrCode).toBeNull();
    expect(res.body.hints.requiresContainerScan).toBe(false);
  });
});
