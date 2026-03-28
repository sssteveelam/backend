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
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductUomService } from '../product-uoms/product-uom.service';
import { CreateProductUomDto } from '../product-uoms/dto/create-product-uom.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productUomService: ProductUomService,
  ) {}

  @Post()
  @RequireRole(['manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateProductDto) {
    return this.productService.create(req.user.id, body);
  }

  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  findAll(@Req() req: AuthenticatedRequest) {
    return this.productService.findAll(req.user.id);
  }

  @Get(':id')
  @RequireRole(['staff', 'manager', 'admin'])
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.productService.findById(req.user.id, id);
  }

  @Patch(':id')
  @RequireRole(['manager', 'admin'])
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.productService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @RequireRole(['admin'])
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.productService.remove(req.user.id, id);
  }

  @Get(':id/uoms')
  @RequireRole(['staff', 'manager', 'admin'])
  getUoms(@Req() req: AuthenticatedRequest, @Param('id') productId: string) {
    return this.productUomService.findByProductId(req.user.id, productId);
  }

  @Post(':id/uoms')
  @RequireRole(['manager', 'admin'])
  createUom(
    @Req() req: AuthenticatedRequest,
    @Param('id') productId: string,
    @Body() body: CreateProductUomDto,
  ) {
    return this.productUomService.create(req.user.id, productId, body);
  }
}
