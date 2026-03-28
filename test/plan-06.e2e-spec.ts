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

describe('Plan 06 E2E - Threshold-based Approval', () => {
  jest.setTimeout(45000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let adminUser: User;
  let managerUser: User;
  let staffUser: User;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;

  let warehouseId: string;
  let locationId: string;
  let location2Id: string;
  let supplierId: string;
  let productId: string;
  let batchId: string;
  let containerId: string;

  const plainPassword = 'Password123!';

  const resetAllTables = async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
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
    adminUser = await prisma.user.create({
      data: { username: 'admin', email: 'admin@test.local', passwordHash, role: 'admin', status: 'active' },
    });
    managerUser = await prisma.user.create({
      data: { username: 'manager', email: 'manager@test.local', passwordHash, role: 'manager', status: 'active' },
    });
    staffUser = await prisma.user.create({
      data: { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff', status: 'active' },
    });
  };

  const seedData = async () => {
    const wh = await prisma.warehouse.create({ data: { code: 'WH-A', name: 'Warehouse A' } });
    warehouseId = wh.id;
    const l1 = await prisma.location.create({
      data: { warehouseId, code: 'LOC-1', name: 'Location 1' },
    });
    locationId = l1.id;
    const l2 = await prisma.location.create({
      data: { warehouseId, code: 'LOC-2', name: 'Location 2' },
    });
    location2Id = l2.id;
    const s1 = await prisma.supplier.create({ data: { code: 'S1', name: 'Supplier S1' } });
    supplierId = s1.id;
    const p1 = await prisma.product.create({
      data: { code: 'P1', name: 'Product P1', baseUom: 'unit' },
    });
    productId = p1.id;

    await prisma.productUom.create({
      data: { productId, supplierId, uom: 'box', factorToBase: 1 },
    });

    const batch = await prisma.batch.create({
      data: {
        productId,
        supplierId,
        lotCode: 'B1',
        manufactureDate: new Date('2026-01-01'),
        expiryDate: new Date('2026-12-31'),
        averageCost: 100000,
      },
    });
    batchId = batch.id;

    const c1 = await prisma.container.create({
      data: { qrCode: 'CONT-1', locationId },
    });
    containerId = c1.id;

    await prisma.stockLine.create({
      data: {
        productId,
        batchId,
        locationId,
        containerId,
        quantityBase: 200,
      },
    });
  };

  const login = async (usernameOrEmail: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail, password: plainPassword });
    return res.body.accessToken as string;
  };

  const createReceipt = async (code: string, token = staffToken) =>
    request(app.getHttpServer())
      .post('/receipts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `create-${code}`)
      .send({ code, supplierId, warehouseId });

  const addReceiptLine = async (
    receiptId: string,
    quantity: number,
    unitCost: number,
    lotCode: string,
    token = staffToken,
  ) =>
    request(app.getHttpServer())
      .post(`/receipts/${receiptId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `line-${lotCode}`)
      .send({
        productId,
        supplierId,
        quantity,
        uom: 'box',
        unitCost,
        manufactureDate: '2026-01-01',
        expiryDate: '2026-12-31',
        lotCode,
      });

  const submitReceipt = async (receiptId: string, key: string, token = managerToken, correlationId = `submit-${receiptId}`) =>
    request(app.getHttpServer())
      .post(`/receipts/${receiptId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', correlationId)
      .set('Idempotency-Key', key)
      .send({});

  const createMovementWithLine = async (code: string, quantityBase: number) => {
    const mv = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', `mv-${code}`)
      .send({ code, fromLocationId: locationId, toLocationId: location2Id });
    await request(app.getHttpServer())
      .post(`/movements/${mv.body.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', `mv-line-${code}`)
      .send({
        productId,
        batchId,
        containerId,
        quantityBase,
      });
    return mv.body.id as string;
  };

  const submitMovement = async (movementId: string, key: string, token = managerToken) =>
    request(app.getHttpServer())
      .post(`/movements/${movementId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', `mv-submit-${movementId}`)
      .set('Idempotency-Key', key)
      .send({
        scanSequence: ['container', 'location'],
        scannedContainerId: containerId,
        scannedContainerQr: 'CONT-1',
        scannedLocationId: location2Id,
        scannedLocationQr: 'LOC-2',
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
    await seedUsers();
    await seedData();
    adminToken = await login('admin');
    managerToken = await login('manager');
    staffToken = await login('staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('Test 1 — Threshold không vượt', async () => {
    const receipt = await createReceipt('RC-T1');
    await addReceiptLine(receipt.body.id, 1, 100000, 'LOT-T1');
    const submit = await submitReceipt(receipt.body.id, 'key-t1');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(false);

    const approval = await prisma.approvalRequest.findFirst({
      where: { documentType: 'receipt', documentId: receipt.body.id },
    });
    expect(approval).toBeNull();
  });

  it('Test 2 — Threshold vượt document value', async () => {
    const receipt = await createReceipt('RC-T2');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T2');
    const submit = await submitReceipt(receipt.body.id, 'key-t2');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();

    const approval = await prisma.approvalRequest.findUnique({ where: { id: submit.body.approvalRequestId } });
    expect(approval?.status).toBe('pending');
  });

  it('Test 3 — Threshold vượt line quantity', async () => {
    const receipt = await createReceipt('RC-T3');
    await addReceiptLine(receipt.body.id, 6, 1000, 'LOT-T3');
    const submit = await submitReceipt(receipt.body.id, 'key-t3');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    const approval = await prisma.approvalRequest.findUnique({ where: { id: submit.body.approvalRequestId } });
    const snapshot = approval?.thresholdSnapshot as { evaluated_result?: { requiresApproval?: boolean; lineQuantityExceeded?: boolean } };
    expect(snapshot?.evaluated_result?.requiresApproval).toBe(true);
    expect(snapshot?.evaluated_result?.lineQuantityExceeded).toBe(true);
  });

  it('Test 4 — Daily threshold', async () => {
    for (let i = 1; i <= 7; i += 1) {
      const rc = await createReceipt(`RC-D${i}`);
      await addReceiptLine(rc.body.id, 2, 800000, `LOT-D${i}`);
      const res = await submitReceipt(rc.body.id, `key-d-${i}`);
      if (i < 7) {
        expect(res.body.blocked).toBe(false);
      } else {
        expect(res.body.blocked).toBe(true);
        expect(res.body.approvalRequestId).toBeTruthy();
      }
    }
  });

  it('Test 5 — Snapshot tồn tại và immutable', async () => {
    const receipt = await createReceipt('RC-T5');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T5');
    const submit = await submitReceipt(receipt.body.id, 'key-t5');
    const approvalId = submit.body.approvalRequestId as string;
    const before = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    const beforeSnapshot = before?.thresholdSnapshot;
    expect(beforeSnapshot).toBeTruthy();
    const snapshotObj = beforeSnapshot as Record<string, unknown>;
    expect(snapshotObj.line_quantity_threshold).toBeTruthy();
    expect(snapshotObj.doc_value_threshold).toBeTruthy();
    expect(snapshotObj.daily_value_threshold).toBeTruthy();
    expect(snapshotObj.evaluated_result).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approve-t5')
      .send({ poCode: 'PO-001' });

    const after = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    expect(after?.thresholdSnapshot).toEqual(beforeSnapshot);
  });

  it('Test 6 — Approval state machine', async () => {
    const receiptA = await createReceipt('RC-T6-A');
    await addReceiptLine(receiptA.body.id, 30, 100000, 'LOT-T6-A');
    const submitA = await submitReceipt(receiptA.body.id, 'key-t6-a');
    const approvalA = submitA.body.approvalRequestId as string;

    const approve = await request(app.getHttpServer())
      .post(`/approvals/${approvalA}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approve-t6-a')
      .send({ poCode: 'PO-T6' });
    expect(approve.status).toBe(201);

    const approveAgain = await request(app.getHttpServer())
      .post(`/approvals/${approvalA}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approve-t6-a-2')
      .send({ poCode: 'PO-T6-2' });
    expect(approveAgain.status).toBe(409);

    const receiptB = await createReceipt('RC-T6-B');
    await addReceiptLine(receiptB.body.id, 30, 100000, 'LOT-T6-B');
    const submitB = await submitReceipt(receiptB.body.id, 'key-t6-b');
    const approvalB = submitB.body.approvalRequestId as string;

    const reject = await request(app.getHttpServer())
      .post(`/approvals/${approvalB}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'reject-t6-b')
      .send({ reason: 'Not accepted' });
    expect(reject.status).toBe(201);

    const rejectAfterApproved = await request(app.getHttpServer())
      .post(`/approvals/${approvalA}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'reject-after-approved')
      .send({ reason: 'should fail' });
    expect(rejectAfterApproved.status).toBe(409);
  });

  it('Test 7 — PO enforcement', async () => {
    const receipt = await createReceipt('RC-T7');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T7');
    const submit = await submitReceipt(receipt.body.id, 'key-t7');
    const approvalId = submit.body.approvalRequestId as string;

    const approve = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approve-t7')
      .send({});
    expect(approve.status).toBe(400);
    expect(approve.body.error.message).toContain('PO_CODE_REQUIRED');
  });

  it('Test 8 — Approve thành công', async () => {
    const receipt = await createReceipt('RC-T8');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T8');
    const submit = await submitReceipt(receipt.body.id, 'key-t8');
    const approvalId = submit.body.approvalRequestId as string;

    const approve = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approve-t8')
      .send({ poCode: 'PO-888' });
    expect(approve.status).toBe(201);
    expect(approve.body.status).toBe('approved');
    expect(approve.body.decidedBy).toBe(managerUser.id);
    expect(approve.body.decidedAt).toBeTruthy();
  });

  it('Test 9 — Reject', async () => {
    const receipt = await createReceipt('RC-T9');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T9');
    const submit = await submitReceipt(receipt.body.id, 'key-t9');
    const approvalId = submit.body.approvalRequestId as string;

    const reject = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'reject-t9')
      .send({ reason: 'No budget' });
    expect(reject.status).toBe(201);
    expect(reject.body.status).toBe('rejected');
    expect(reject.body.reason).toBe('No budget');
  });

  it('Test 10 — RBAC', async () => {
    const receipt = await createReceipt('RC-T10');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T10');
    const submit = await submitReceipt(receipt.body.id, 'key-t10');
    const approvalId = submit.body.approvalRequestId as string;

    const staffApprove = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'rbac-staff')
      .send({ poCode: 'PO-RBAC' });
    expect(staffApprove.status).toBe(403);

    const managerApprove = await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'rbac-manager')
      .send({ poCode: 'PO-RBAC' });
    expect(managerApprove.status).toBe(201);

    const receipt2 = await createReceipt('RC-T10-2');
    await addReceiptLine(receipt2.body.id, 30, 100000, 'LOT-T10-2');
    const submit2 = await submitReceipt(receipt2.body.id, 'key-t10-2');
    const approvalId2 = submit2.body.approvalRequestId as string;

    const adminApprove = await request(app.getHttpServer())
      .post(`/approvals/${approvalId2}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', 'rbac-admin')
      .send({ poCode: 'PO-ADMIN' });
    expect(adminApprove.status).toBe(201);
  });

  it('Test 11 — Integration Receipt', async () => {
    const receipt = await createReceipt('RC-T11');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T11');
    const submit = await submitReceipt(receipt.body.id, 'key-t11');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();
  });

  it('Test 12 — Integration Movement', async () => {
    const movementId = await createMovementWithLine('MV-T12', 20);
    const submit = await submitMovement(movementId, 'key-mv-t12');
    expect(submit.status).toBe(201);
    expect(submit.body.blocked).toBe(true);
    expect(submit.body.approvalRequestId).toBeTruthy();

    const approval = await prisma.approvalRequest.findFirst({
      where: { documentType: 'movement', documentId: movementId },
    });
    expect(approval).toBeTruthy();
  });

  it('Test 13 — Audit', async () => {
    const receiptA = await createReceipt('RC-T13-A');
    await addReceiptLine(receiptA.body.id, 30, 100000, 'LOT-T13-A');
    const submitA = await submitReceipt(receiptA.body.id, 'key-t13-a');
    const approvalA = submitA.body.approvalRequestId as string;
    await request(app.getHttpServer())
      .post(`/approvals/${approvalA}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'audit-approve')
      .send({ poCode: 'PO-AUDIT' });

    const receiptB = await createReceipt('RC-T13-B');
    await addReceiptLine(receiptB.body.id, 30, 100000, 'LOT-T13-B');
    const submitB = await submitReceipt(receiptB.body.id, 'key-t13-b');
    const approvalB = submitB.body.approvalRequestId as string;
    await request(app.getHttpServer())
      .post(`/approvals/${approvalB}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'audit-reject')
      .send({ reason: 'Rejected audit' });

    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: ['CREATE_APPROVAL_REQUEST', 'APPROVE_REQUEST', 'REJECT_REQUEST'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(events.some((e) => e.action === 'CREATE_APPROVAL_REQUEST')).toBe(true);
    expect(events.some((e) => e.action === 'APPROVE_REQUEST')).toBe(true);
    expect(events.some((e) => e.action === 'REJECT_REQUEST')).toBe(true);
    for (const e of events) {
      expect(e.actorUserId).toBeTruthy();
      expect(e.correlationId).toBeTruthy();
      if (e.action === 'CREATE_APPROVAL_REQUEST') {
        const after = e.afterJson as { thresholdSnapshot?: unknown; threshold_snapshot?: unknown };
        expect(after).toBeTruthy();
        expect(after.thresholdSnapshot ?? after.threshold_snapshot).toBeTruthy();
      } else {
        expect(e.beforeJson).toBeTruthy();
        expect(e.afterJson).toBeTruthy();
      }
    }
  });

  it('Test 14 — Context propagation', async () => {
    const receipt = await createReceipt('RC-T14');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T14');
    const submit = await submitReceipt(receipt.body.id, 'key-t14');
    const approvalId = submit.body.approvalRequestId as string;

    await request(app.getHttpServer())
      .post(`/approvals/${approvalId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-correlation-id', 'approval-123')
      .send({ poCode: 'PO-CORR' });

    const event = await prisma.auditEvent.findFirst({
      where: { action: 'APPROVE_REQUEST', entityId: approvalId },
      orderBy: { createdAt: 'desc' },
    });
    expect(event?.correlationId).toBe('approval-123');
  });

  it('Test 15 — Idempotency safety: không tạo duplicate approval_request', async () => {
    const receipt = await createReceipt('RC-T15');
    await addReceiptLine(receipt.body.id, 30, 100000, 'LOT-T15');

    const first = await submitReceipt(receipt.body.id, 'key-t15');
    const second = await submitReceipt(receipt.body.id, 'key-t15');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const approvals = await prisma.approvalRequest.findMany({
      where: { documentType: 'receipt', documentId: receipt.body.id },
    });
    expect(approvals).toHaveLength(1);
  });
});
