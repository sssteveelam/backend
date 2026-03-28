import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { AddMovementLineDto } from './dto/add-movement-line.dto';
import { AdminAdjustmentDto } from './dto/admin-adjustment.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { SubmitMovementDto } from './dto/submit-movement.dto';
import { MovementService } from './movement.service';
import { MovementListQueryDto } from './dto/movement-list-query.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  // PROPOSED NEW API: GET /movements
  @Get('movements')
  @RequireRole(['staff', 'manager', 'admin'])
  listMovements(@Query() query: MovementListQueryDto) {
    return this.movementService.listMovements(query);
  }

  // PROPOSED NEW API: GET /movements/:id
  @Get('movements/:id')
  @RequireRole(['staff', 'manager', 'admin'])
  getMovementDetail(@Param('id') movementId: string) {
    return this.movementService.getMovementDetail(movementId);
  }

  @Post('movements')
  @RequireRole(['staff', 'manager', 'admin'])
  createMovement(@Req() req: AuthenticatedRequest, @Body() body: CreateMovementDto) {
    return this.movementService.createMovement(req.user.id, body);
  }

  @Post('movements/:id/lines')
  @RequireRole(['staff', 'manager', 'admin'])
  addLine(
    @Req() req: AuthenticatedRequest,
    @Param('id') movementId: string,
    @Body() body: AddMovementLineDto,
  ) {
    return this.movementService.addLine(req.user.id, movementId, body);
  }

  @Post('movements/:id/submit')
  @RequireRole(['staff', 'manager', 'admin'])
  submitMovement(
    @Req() req: AuthenticatedRequest,
    @Param('id') movementId: string,
    @Body() body: SubmitMovementDto,
  ) {
    const idempotencyKey = (req as unknown as { headers: Record<string, string | undefined> }).headers['idempotency-key'];
    return this.movementService.submitMovement(
      req.user.id,
      req.user.role,
      movementId,
      idempotencyKey ?? '',
      body,
    );
  }

  @Post('admin/adjustments')
  @RequireRole(['admin'])
  adminAdjustment(@Req() req: AuthenticatedRequest, @Body() body: AdminAdjustmentDto) {
    return this.movementService.adminAdjustment(req.user.id, req.user.role, body);
  }
}
