import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PrismaService } from '../src/modules/prisma/prisma.service';

dotenv.config({ path: '.env.test' });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for e2e tests');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

@Controller('test-rbac')
class TestRbacController {
  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRole(['admin'])
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}

describe('Plan 01 E2E', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  let adminUser: User;
  let managerUser: User;
  let staffUser: User;

  const plainPassword = 'Password123!';

  const resetAllTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.idempotency_keys,
        public.audit_events,
        public.users
      CASCADE;
    `);
  };

  const clearTransactionalTables = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        public.idempotency_keys,
        public.audit_events
      CASCADE;
    `);
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

  const login = async (usernameOrEmail: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail,
      password,
    });

    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    console.log('DATABASE_URL_TEST:', process.env.DATABASE_URL_TEST);

    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });

    prisma = new PrismaClient();
    await prisma.$connect();

    const currentDb = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database();
    `;
    console.log('Prisma test client current_database:', currentDb[0]?.current_database);

    await resetAllTables();
    await seedUsers();

    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestRbacController],
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

    const appPrisma = app.get(PrismaService);
    const appCurrentDb = await appPrisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database();
    `;
    console.log('Prisma AppModule current_database:', appCurrentDb[0]?.current_database);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await clearTransactionalTables();
  });

  it('Test 1 — Login thành công', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail: 'admin',
      password: plainPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.role).toBe('admin');
  });

  it('Test 2 — Login thất bại', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      usernameOrEmail: 'admin',
      password: 'WrongPassword!123',
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Sai username/email hoặc mật khẩu',
      },
    });
  });

  it('Test 3 — GET /me + correlation_id', async () => {
    const token = await login('admin', plainPassword);

    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'test-123');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(adminUser.id);
    expect(res.body.username).toBe('admin');
    expect(res.body.role).toBe('admin');
  });

  it('Test 4 — Audit log (USER_LOGIN + USER_VIEW_ME)', async () => {
    const token = await login('admin', plainPassword);

    const meRes = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'test-123');

    expect(meRes.status).toBe(200);

    const auditEvents = await prisma.auditEvent.findMany({
      orderBy: { createdAt: 'asc' },
    });

    expect(auditEvents).toHaveLength(2);

    expect(auditEvents[0].action).toBe('USER_LOGIN');
    expect(auditEvents[0].actorUserId).toBe(adminUser.id);
    expect(auditEvents[0].correlationId).toBeTruthy();

    expect(auditEvents[1].action).toBe('USER_VIEW_ME');
    expect(auditEvents[1].actorUserId).toBe(adminUser.id);
    expect(auditEvents[1].correlationId).toBe('test-123');
  });

  it('Test 5 — RBAC: staff gọi admin endpoint bị 403', async () => {
    const staffToken = await login('staff', plainPassword);

    const res = await request(app.getHttpServer())
      .get('/test-rbac/admin-only')
      .set('Authorization', `Bearer ${staffToken}`)
      .set('x-correlation-id', 'rbac-403');

    expect(res.status).toBe(403);
  });

  it('Test 6 — Context propagation (AsyncLocalStorage) cho correlation_id', async () => {
    const token = await login('manager', plainPassword);

    const meRes = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'context-999');

    expect(meRes.status).toBe(200);

    const viewMeAudit = await prisma.auditEvent.findFirst({
      where: {
        action: 'USER_VIEW_ME',
        actorUserId: managerUser.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(viewMeAudit).toBeTruthy();
    expect(viewMeAudit?.correlationId).toBe('context-999');
  });
});
