import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { InventoryQueryService } from '../services/inventory-query.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationInventoryController {
  constructor(private readonly inventoryQueryService: InventoryQueryService) {}

  @Get(':qr_code')
  @RequireRole(['staff', 'manager', 'admin'])
  viewLocation(@Req() req: AuthenticatedRequest, @Param('qr_code') qrCode: string) {
    return this.inventoryQueryService.viewLocationByQr(req.user.id, qrCode);
  }
}
