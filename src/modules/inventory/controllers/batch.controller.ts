import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { BatchService } from '../services/batch.service';

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  viewBatches(
    @Req() req: AuthenticatedRequest,
    @Query('product_id') productId?: string,
    @Query('near_expiry_days') nearExpiryDays?: string,
  ) {
    const days = nearExpiryDays ? Number(nearExpiryDays) : undefined;
    return this.batchService.viewBatches(req.user.id, {
      productId,
      nearExpiryDays: Number.isFinite(days) ? days : undefined,
    });
  }
}
