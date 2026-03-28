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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierService } from './supplier.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @RequireRole(['manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateSupplierDto) {
    return this.supplierService.create(req.user.id, body);
  }

  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  findAll(@Req() req: AuthenticatedRequest) {
    return this.supplierService.findAll(req.user.id);
  }

  @Get(':id')
  @RequireRole(['staff', 'manager', 'admin'])
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.supplierService.findById(req.user.id, id);
  }

  @Patch(':id')
  @RequireRole(['manager', 'admin'])
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    return this.supplierService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @RequireRole(['admin'])
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.supplierService.remove(req.user.id, id);
  }
}
