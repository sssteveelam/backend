import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { ProductUomService } from '../src/modules/master-data/product-uoms/product-uom.service';

dotenv.config({ path: '.env.test' });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for e2e tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

describe('Plan 02 E2E - Master Data', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let adminUser: User;
  let managerUser: User;
  let staffUser: User;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;

  let warehouseAId: string;
  let supplierS1Id: string;
  let supplierS2Id: string;
  let productP1Id: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
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

  const login = async (usernameOrEmail: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail,
      password,
    });

    return res.body.accessToken as string;
  };

  const seedUsers = async (): Promise<void> => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@test.local',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
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

    staffUser = await prisma.user.create({
      data: {
        username: 'staff',
        email: 'staff@test.local',
        passwordHash,
        role: 'staff',
        status: 'active',
      },
    });
  };

  const seedMasterData = async (): Promise<void> => {
    const warehouseA = await prisma.warehouse.create({
      data: {
        code: 'WH-A',
        name: 'Warehouse A',
      },
    });
    warehouseAId = warehouseA.id;

    const supplierS1 = await prisma.supplier.create({
      data: {
        code: 'S1',
        name: 'Supplier 1',
      },
    });
    supplierS1Id = supplierS1.id;

    const supplierS2 = await prisma.supplier.create({
      data: {
        code: 'S2',
        name: 'Supplier 2',
      },
    });
    supplierS2Id = supplierS2.id;

    const productP1 = await prisma.product.create({
      data: {
        code: 'P1',
        name: 'Product 1',
        baseUom: 'kg',
      },
    });
    productP1Id = productP1.id;
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
    await seedUsers();

    adminToken = await login('admin', plainPassword);
    managerToken = await login('manager', plainPassword);
    staffToken = await login('staff', plainPassword);

    await seedMasterData();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Create warehouse', async () => {
    const res = await request(app.getHttpServer())
      .post('/warehouses')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t1')
      .send({ code: 'WH-NEW', name: 'Warehouse New' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('WH-NEW');

    const inDb = await prisma.warehouse.findUnique({ where: { code: 'WH-NEW' } });
    expect(inDb).toBeTruthy();
  });

  it('Test 2 — Duplicate warehouse code', async () => {
    const first = await request(app.getHttpServer())
      .post('/warehouses')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t2-a')
      .send({ code: 'WH-DUP', name: 'Warehouse Dup 1' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/warehouses')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t2-b')
      .send({ code: 'WH-DUP', name: 'Warehouse Dup 2' });

    expect([400, 409]).toContain(second.status);
  });

  it('Test 3 — Location unique theo warehouse', async () => {
    const createA1InWarehouseA = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t3-a')
      .send({
        warehouseId: warehouseAId,
        code: 'A1',
        name: 'Location A1 in Warehouse A',
      });
    expect(createA1InWarehouseA.status).toBe(201);

    const duplicateA1InWarehouseA = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t3-b')
      .send({
        warehouseId: warehouseAId,
        code: 'A1',
        name: 'Location Duplicate',
      });
    expect(duplicateA1InWarehouseA.status).toBeGreaterThanOrEqual(400);

    const warehouseB = await prisma.warehouse.create({
      data: {
        code: 'WH-B',
        name: 'Warehouse B',
      },
    });

    const createA1InWarehouseB = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t3-c')
      .send({
        warehouseId: warehouseB.id,
        code: 'A1',
        name: 'Location A1 in Warehouse B',
      });
    expect(createA1InWarehouseB.status).toBe(201);
  });

  it('Test 4 — Product UoM validation', async () => {
    const invalid = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t4-a')
      .send({ supplierId: supplierS1Id, uom: 'box', factorToBase: 0 });

    expect(invalid.status).toBeGreaterThanOrEqual(400);

    const valid = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t4-b')
      .send({ supplierId: supplierS1Id, uom: 'box', factorToBase: 10 });

    expect(valid.status).toBe(201);
    expect(valid.body.factorToBase).toBeDefined();
  });

  it('Test 5 — Duplicate product_uom', async () => {
    const first = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t5-a')
      .send({ supplierId: supplierS1Id, uom: 'bag', factorToBase: 5 });
    expect(first.status).toBe(201);

    const duplicate = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t5-b')
      .send({ supplierId: supplierS1Id, uom: 'bag', factorToBase: 5 });

    expect(duplicate.status).toBeGreaterThanOrEqual(400);
  });

  it('Test 6 — UoM conversion rule', async () => {
    const supplierSpecific = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t6-a')
      .send({ supplierId: supplierS1Id, uom: 'box', factorToBase: 10 });
    expect(supplierSpecific.status).toBe(201);

    const fallback = await request(app.getHttpServer())
      .post(`/products/${productP1Id}/uoms`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t6-b')
      .send({ uom: 'box', factorToBase: 8 });
    expect(fallback.status).toBe(201);

    const productUomService = app.get(ProductUomService);

    const conversionForS1 = await productUomService.resolveConversion({
      productId: productP1Id,
      supplierId: supplierS1Id,
      uom: 'box',
    });
    expect(Number(conversionForS1.factorToBase)).toBe(10);

    const conversionForS2 = await productUomService.resolveConversion({
      productId: productP1Id,
      supplierId: supplierS2Id,
      uom: 'box',
    });
    expect(Number(conversionForS2.factorToBase)).toBe(8);
  });

  it('Test 7 — RBAC', async () => {
    const staffCreate = await request(app.getHttpServer())
      .post('/warehouses')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'plan02-t7-a')
      .send({ code: 'WH-RBAC-S', name: 'Should fail by staff' });
    expect(staffCreate.status).toBe(403);

    const managerCreate = await request(app.getHttpServer())
      .post('/warehouses')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t7-b')
      .send({ code: 'WH-RBAC-M', name: 'Created by manager' });
    expect(managerCreate.status).toBe(201);

    const managerDelete = await request(app.getHttpServer())
      .delete(`/warehouses/${managerCreate.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-t7-c');
    expect(managerDelete.status).toBe(403);

    const adminDelete = await request(app.getHttpServer())
      .delete(`/warehouses/${managerCreate.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'plan02-t7-d');
    expect(adminDelete.status).toBe(200);
  });

  it('Test 8 — Audit create/update product', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-audit-create')
      .send({ code: 'P-AUD', name: 'Product Audit', baseUom: 'kg' });

    expect(createRes.status).toBe(201);

    const createAudit = await prisma.auditEvent.findFirst({
      where: {
        action: 'CREATE_PRODUCT',
        entityId: createRes.body.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(createAudit).toBeTruthy();
    expect(createAudit?.actorUserId).toBe(managerUser.id);
    expect(createAudit?.correlationId).toBe('plan02-audit-create');
    expect(createAudit?.afterJson).toBeTruthy();

    const updateRes = await request(app.getHttpServer())
      .patch(`/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'plan02-audit-update')
      .send({ name: 'Product Audit Updated' });

    expect(updateRes.status).toBe(200);

    const updateAudit = await prisma.auditEvent.findFirst({
      where: {
        action: 'UPDATE_PRODUCT',
        entityId: createRes.body.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(updateAudit).toBeTruthy();
    const before = updateAudit?.beforeJson as { name?: string };
    const after = updateAudit?.afterJson as { name?: string };

    expect(before.name).toBe('Product Audit');
    expect(after.name).toBe('Product Audit Updated');
  });
});
