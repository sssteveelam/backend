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

describe('Plan 12 E2E - Cycle Count', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let staffUser: User;
  let managerUser: User;
  let adminUser: User;
  let staffToken: string;
  let managerToken: string;
  let adminToken: string;
  let warehouseId: string;
  let locationId: string;
  let supplierId: string;
  let productId: string;
  let batchId: string;
  let containerId: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.cycle_count_lines,
        public.cycle_counts,
        public.pick_tasks,
        public.issue_lines,
        public.issues,
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

  const seedUsers = async () => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    staffUser = await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
    });
    managerUser = await prisma.user.create({
      data: { username: 'manager', email: 'manager@test.local', passwordHash, role: 'manager', status: 'active' },
    });
    adminUser = await prisma.user.create({
      data: { username: 'admin', email: 'admin@test.local', passwordHash, role: 'admin', status: 'active' },
    });
  };

  const seedData = async () => {
    const warehouse = await prisma.warehouse.create({ data: { code: 'WH-C', name: 'Warehouse C' } });
    warehouseId = warehouse.id;
    locationId = (
      await prisma.location.create({
        data: { warehouseId, code: 'L-C', name: 'Location C' },
      })
    ).id;
    supplierId = (await prisma.supplier.create({ data: { code: 'S-C', name: 'Supplier C' } })).id;
    productId = (
      await prisma.product.create({
        data: { code: 'P-C', name: 'Product C', baseUom: 'kg' },
      })
    ).id;
    batchId = (
      await prisma.batch.create({
        data: {
          productId,
          supplierId,
          lotCode: 'B-C',
          manufactureDate: new Date('2026-01-01'),
          expiryDate: new Date('2026-12-31'),
          averageCost: 100,
        },
      })
    ).id;
    containerId = (
      await prisma.container.create({
        data: { qrCode: 'CONT-C', locationId },
      })
    ).id;
    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId,
        containerId,
        quantityBase: 10,
      },
    });
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
    process.env.CYCLE_COUNT_APPROVAL_DELTA_THRESHOLD = '0';
    await resetAllTables();
    await seedUsers();
    await seedData();
    staffToken = await login('staff');
    managerToken = await login('manager');
    adminToken = await login('admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('create + add line + submit applies adjustment', async () => {
    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-1')
      .send({ code: 'CC-1', locationId });
    expect(created.status).toBe(201);

    const addLine = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-1')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 15,
        scanSequence: ['location', 'container'],
        scannedLocationId: locationId,
        scannedContainerId: containerId,
      });
    expect(addLine.status).toBe(201);

    const submit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'cc-submit-1')
      .send({});
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(false);
    expect(submit.body.cycleCount.status).toBe('submitted');
    expect(submit.body.deltas[0].delta).toBe(5);

    const stock = await prisma.stockLine.findFirst({
      where: { locationId, productId, batchId, containerId },
    });
    expect(Number(stock?.quantityBase ?? 0)).toBe(15);
  });

  it('scan order container -> location also works', async () => {
    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-2')
      .send({ code: 'CC-2', locationId });

    const addLine = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-2')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 9,
        scanSequence: ['container', 'location'],
        scannedLocationId: locationId,
        scannedContainerId: containerId,
      });
    expect(addLine.status).toBe(201);
  });

  it('cannot submit when no lines', async () => {
    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-3')
      .send({ code: 'CC-3', locationId });

    const submit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'cc-submit-3')
      .send({});
    expect(submit.status).toBe(400);
  });

  it('optional approval branch blocks submit', async () => {
    process.env.CYCLE_COUNT_APPROVAL_DELTA_THRESHOLD = '1';

    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-4')
      .send({ code: 'CC-4', locationId });
    await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-4')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 20,
      });

    const submit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'cc-submit-4')
      .send({});
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: submit.body.approvalRequestId as string },
    });
    expect(approval?.status).toBe('pending');
  });

  it('rbac: staff create/count, manager submit, admin submit', async () => {
    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-5')
      .send({ code: 'CC-5', locationId });
    expect(created.status).toBe(201);

    const line = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-5')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 8,
      });
    expect(line.status).toBe(201);

    const staffSubmit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-submit-5-staff')
      .send({});
    expect(staffSubmit.status).toBe(403);

    const managerSubmit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'cc-submit-5-manager')
      .send({});
    expect(managerSubmit.status).toBe(201);

    const created2 = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-5b')
      .send({ code: 'CC-5B', locationId });
    await request(app.getHttpServer())
      .post(`/cycle-counts/${created2.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-5b')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 8,
      });
    const adminSubmit = await request(app.getHttpServer())
      .post(`/cycle-counts/${created2.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'cc-submit-5-admin')
      .send({});
    expect(adminSubmit.status).toBe(201);
  });

  it('audit contains cycle-count actions and adjustment details', async () => {
    const created = await request(app.getHttpServer())
      .post('/cycle-counts')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-create-6')
      .send({ code: 'CC-6', locationId });
    await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'cc-line-6')
      .send({
        productId,
        batchId,
        containerId,
        countedQuantity: 14,
      });
    await request(app.getHttpServer())
      .post(`/cycle-counts/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'cc-submit-6')
      .send({});

    const events = await prisma.auditEvent.findMany({
      where: {
        action: {
          in: [
            'CREATE_CYCLE_COUNT',
            'ADD_CYCLE_COUNT_LINE',
            'SUBMIT_CYCLE_COUNT',
            'APPLY_ADJUSTMENT_FROM_COUNT',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(events.some((e) => e.action === 'CREATE_CYCLE_COUNT')).toBe(true);
    expect(events.some((e) => e.action === 'ADD_CYCLE_COUNT_LINE')).toBe(true);
    expect(events.some((e) => e.action === 'SUBMIT_CYCLE_COUNT')).toBe(true);
    expect(events.some((e) => e.action === 'APPLY_ADJUSTMENT_FROM_COUNT')).toBe(true);

    const adj = events.find((e) => e.action === 'APPLY_ADJUSTMENT_FROM_COUNT');
    expect(adj?.actorUserId).toBe(managerUser.id);
    expect(adj?.correlationId).toBe('cc-submit-6');
    expect(adj?.reason).toBe('cycle_count');
    expect(adj?.beforeJson).toBeTruthy();
    expect(adj?.afterJson).toBeTruthy();
  });
});
