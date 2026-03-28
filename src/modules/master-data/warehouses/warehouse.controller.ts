import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseService } from './warehouse.service';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequireRole(['manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateWarehouseDto) {
    return this.warehouseService.create(req.user.id, body);
  }

  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  findAll(@Req() req: AuthenticatedRequest) {
    return this.warehouseService.findAll(req.user.id);
  }

  @Get(':id')
  @RequireRole(['staff', 'manager', 'admin'])
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.warehouseService.findById(req.user.id, id);
  }

  @Patch(':id')
  @RequireRole(['manager', 'admin'])
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateWarehouseDto,
  ) {
    return this.warehouseService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @RequireRole(['admin'])
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.warehouseService.remove(req.user.id, id);
  }
}
