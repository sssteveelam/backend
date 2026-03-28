import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { AddCycleCountLineDto } from './dto/add-cycle-count-line.dto';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import { CycleCountListQueryDto } from './dto/cycle-count-list-query.dto';
import { SubmitCycleCountDto } from './dto/submit-cycle-count.dto';
import { CycleCountService } from './cycle-count.service';

@Controller('cycle-counts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CycleCountController {
  constructor(private readonly cycleCountService: CycleCountService) {}

  // PROPOSED NEW API: list cycle counts
  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  list(@Query() query: CycleCountListQueryDto) {
    return this.cycleCountService.listCycleCounts(query);
  }

  // PROPOSED NEW API: cycle count detail with lines
  @Get(':id')
  @RequireRole(['staff', 'manager', 'admin'])
  detail(@Param('id') cycleCountId: string) {
    return this.cycleCountService.getCycleCountDetail(cycleCountId);
  }

  @Post()
  @RequireRole(['staff', 'manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateCycleCountDto) {
    return this.cycleCountService.create(req.user.id, body);
  }

  @Post(':id/lines')
  @RequireRole(['staff', 'manager', 'admin'])
  addLine(
    @Req() req: AuthenticatedRequest,
    @Param('id') cycleCountId: string,
    @Body() body: AddCycleCountLineDto,
  ) {
    return this.cycleCountService.addLine(req.user.id, cycleCountId, body);
  }

  @Post(':id/submit')
  @RequireRole(['manager', 'admin'])
  submit(
    @Req() req: AuthenticatedRequest,
    @Param('id') cycleCountId: string,
    @Body() body: SubmitCycleCountDto,
  ) {
    return this.cycleCountService.submit(req.user.id, cycleCountId, body);
  }
}
