import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { AuditService } from './audit.service';
import { ListResponse } from '../../common/dto/list-response.dto';
import { AuditLogItemDto } from './dto/audit-log-item.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // PROPOSED NEW API: GET /audit (admin read-only)
  @Get()
  @RequireRole(['admin'])
  list(@Query() query: AuditListQueryDto): Promise<ListResponse<AuditLogItemDto>> {
    return this.auditService.listAuditEvents(query);
  }
}

