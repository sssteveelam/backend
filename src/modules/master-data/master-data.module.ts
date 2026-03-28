import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WarehouseController } from './warehouses/warehouse.controller';
import { WarehouseService } from './warehouses/warehouse.service';
import { WarehouseRepository } from './warehouses/warehouse.repository';
import { LocationController } from './locations/location.controller';
import { LocationService } from './locations/location.service';
import { LocationRepository } from './locations/location.repository';
import { SupplierController } from './suppliers/supplier.controller';
import { SupplierService } from './suppliers/supplier.service';
import { SupplierRepository } from './suppliers/supplier.repository';
import { ProductController } from './products/product.controller';
import { ProductService } from './products/product.service';
import { ProductRepository } from './products/product.repository';
import { ProductUomService } from './product-uoms/product-uom.service';
import { ProductUomRepository } from './product-uoms/product-uom.repository';

@Module({
  imports: [AuditModule],
  controllers: [
    WarehouseController,
    LocationController,
    SupplierController,
    ProductController,
  ],
  providers: [
    WarehouseService,
    WarehouseRepository,
    LocationService,
    LocationRepository,
    SupplierService,
    SupplierRepository,
    ProductService,
    ProductRepository,
    ProductUomService,
    ProductUomRepository,
  ],
  exports: [
    ProductUomService,
    ProductRepository,
    SupplierRepository,
    LocationRepository,
    WarehouseRepository,
    ProductUomRepository,
  ],
})
export class MasterDataModule {}
