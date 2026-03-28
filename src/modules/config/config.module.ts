import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppTimeoutConfigService } from './app-timeout-config.service';
import { ConfigTimeoutsController } from './config-timeouts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ConfigTimeoutsController],
  providers: [AppTimeoutConfigService],
  exports: [AppTimeoutConfigService],
})
export class AppConfigModule {}
