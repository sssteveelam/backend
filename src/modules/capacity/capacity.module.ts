import { Module } from '@nestjs/common';
import { CapacityService } from './capacity.service';

@Module({
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
