import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/request-user.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../../auth/guards/roles.guard';
import { InventoryQueryService } from '../services/inventory-query.service';
import { InventorySuggestionQueryDto } from '../dto/inventory-suggestion.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryQueryService: InventoryQueryService) {}

  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  viewInventory(
    @Req() req: AuthenticatedRequest,
    @Query('product_id') productId?: string,
    @Query('location_id') locationId?: string,
  ) {
    return this.inventoryQueryService.viewInventory(req.user.id, {
      productId,
      locationId,
    });
  }

  /**
   * PROPOSED NEW API: Get inventory suggestions based on FEFO and availability.
   * Path: GET /inventory/suggestions
   */
  @Get('suggestions')
  @RequireRole(['staff', 'manager', 'admin'])
  getSuggestions(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventorySuggestionQueryDto,
  ) {
    return this.inventoryQueryService.getSuggestions(req.user.id, query);
  }

  @Get('near-expiry')
  @RequireRole(['staff', 'manager', 'admin'])
  viewNearExpiry(@Req() req: AuthenticatedRequest, @Query('days') days = '7') {
    const parsedDays = Number(days);
    return this.inventoryQueryService.viewNearExpiry(
      req.user.id,
      Number.isFinite(parsedDays) ? parsedDays : 7,
    );
  }
}
