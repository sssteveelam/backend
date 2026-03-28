import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { AppTimeoutConfigService } from './app-timeout-config.service';
import { UpdateTimeoutsDto } from './dto/update-timeouts.dto';

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigTimeoutsController {
  constructor(private readonly appTimeoutConfigService: AppTimeoutConfigService) {}

  @Get('timeouts')
  @RequireRole(['staff', 'manager', 'admin'])
  getTimeouts() {
    return this.appTimeoutConfigService.getTimeouts();
  }

  @Put('timeouts')
  @RequireRole(['admin'])
  putTimeouts(@Req() req: AuthenticatedRequest, @Body() body: UpdateTimeoutsDto) {
    return this.appTimeoutConfigService.updateTimeouts(body);
  }
}
