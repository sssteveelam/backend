import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationService } from './location.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post('locations')
  @RequireRole(['manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateLocationDto) {
    return this.locationService.create(req.user.id, body);
  }

  @Get('warehouses/:id/locations')
  @RequireRole(['staff', 'manager', 'admin'])
  findByWarehouse(@Req() req: AuthenticatedRequest, @Param('id') warehouseId: string) {
    return this.locationService.findByWarehouseId(req.user.id, warehouseId);
  }
}
