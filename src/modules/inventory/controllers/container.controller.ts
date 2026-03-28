import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { OpenSealDto } from '../dto/open-seal.dto';
import { InventoryQueryService } from '../services/inventory-query.service';
import { ContainerSealService } from '../services/container-seal.service';

@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContainerController {
  constructor(
    private readonly inventoryQueryService: InventoryQueryService,
    private readonly containerSealService: ContainerSealService,
  ) {}

  @Get(':qr_code')
  @RequireRole(['staff', 'manager', 'admin'])
  viewContainer(@Req() req: AuthenticatedRequest, @Param('qr_code') qrCode: string) {
    return this.inventoryQueryService.viewContainerByQr(req.user.id, qrCode);
  }

  @Post(':qr_code/open-seal')
  @RequireRole(['staff', 'manager', 'admin'])
  openSeal(
    @Req() req: AuthenticatedRequest,
    @Param('qr_code') qrCode: string,
    @Body() body: OpenSealDto,
  ) {
    return this.containerSealService.openSeal(req.user.id, qrCode, body);
  }
}
