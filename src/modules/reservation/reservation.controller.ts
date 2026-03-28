import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { SoftReserveDto } from './dto/soft-reserve.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ReservationService } from './reservation.service';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post('soft-reserve')
  @RequireRole(['staff', 'manager', 'admin'])
  softReserve(@Req() req: AuthenticatedRequest, @Body() body: SoftReserveDto) {
    return this.reservationService.softReserve(req.user.id, body);
  }

  @Post(':id/hard-lock')
  @RequireRole(['staff', 'manager', 'admin'])
  hardLock(@Req() req: AuthenticatedRequest, @Param('id') reservationId: string) {
    return this.reservationService.hardLock(req.user.id, reservationId);
  }

  @Post(':id/release')
  @RequireRole(['staff', 'manager', 'admin'])
  release(@Req() req: AuthenticatedRequest, @Param('id') reservationId: string) {
    return this.reservationService.release(req.user.id, reservationId);
  }

  @Post(':id/activity')
  @RequireRole(['staff', 'manager', 'admin'])
  updateActivity(
    @Req() req: AuthenticatedRequest,
    @Param('id') reservationId: string,
    @Body() body: UpdateActivityDto,
  ) {
    return this.reservationService.updateActivity(req.user.id, reservationId, body.action);
  }
}
