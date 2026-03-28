import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { ContextModule } from './modules/context/context.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { ContextMiddleware } from './middleware/context.middleware';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { MovementModule } from './modules/movement/movement.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { IssueModule } from './modules/issue/issue.module';
import { CycleCountModule } from './modules/cycle-count/cycle-count.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ContextModule,
    AuditModule,
    AuthModule,
    IdempotencyModule,
    MasterDataModule,
    InventoryModule,
    ReceiptModule,
    MovementModule,
    ApprovalModule,
    ReservationModule,
    IssueModule,
    CycleCountModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*');
    consumer.apply(IdempotencyMiddleware).forRoutes('*');
  }
}
