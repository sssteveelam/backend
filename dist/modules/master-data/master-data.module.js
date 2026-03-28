"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterDataModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const warehouse_controller_1 = require("./warehouses/warehouse.controller");
const warehouse_service_1 = require("./warehouses/warehouse.service");
const warehouse_repository_1 = require("./warehouses/warehouse.repository");
const location_controller_1 = require("./locations/location.controller");
const location_service_1 = require("./locations/location.service");
const location_repository_1 = require("./locations/location.repository");
const supplier_controller_1 = require("./suppliers/supplier.controller");
const supplier_service_1 = require("./suppliers/supplier.service");
const supplier_repository_1 = require("./suppliers/supplier.repository");
const product_controller_1 = require("./products/product.controller");
const product_service_1 = require("./products/product.service");
const product_repository_1 = require("./products/product.repository");
const product_uom_service_1 = require("./product-uoms/product-uom.service");
const product_uom_repository_1 = require("./product-uoms/product-uom.repository");
let MasterDataModule = class MasterDataModule {
};
exports.MasterDataModule = MasterDataModule;
exports.MasterDataModule = MasterDataModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule],
        controllers: [
            warehouse_controller_1.WarehouseController,
            location_controller_1.LocationController,
            supplier_controller_1.SupplierController,
            product_controller_1.ProductController,
        ],
        providers: [
            warehouse_service_1.WarehouseService,
            warehouse_repository_1.WarehouseRepository,
            location_service_1.LocationService,
            location_repository_1.LocationRepository,
            supplier_service_1.SupplierService,
            supplier_repository_1.SupplierRepository,
            product_service_1.ProductService,
            product_repository_1.ProductRepository,
            product_uom_service_1.ProductUomService,
            product_uom_repository_1.ProductUomRepository,
        ],
        exports: [
            product_uom_service_1.ProductUomService,
            product_repository_1.ProductRepository,
            supplier_repository_1.SupplierRepository,
            location_repository_1.LocationRepository,
            warehouse_repository_1.WarehouseRepository,
            product_uom_repository_1.ProductUomRepository,
        ],
    })
], MasterDataModule);
//# sourceMappingURL=master-data.module.js.map