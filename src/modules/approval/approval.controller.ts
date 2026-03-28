import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { ApproveApprovalDto } from './dto/approve-approval.dto';
import { RejectApprovalDto } from './dto/reject-approval.dto';
import { ApprovalService } from './approval.service';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  @RequireRole(['manager', 'admin'])
  list(@Query('status') status?: string) {
    return this.approvalService.listApprovals(status);
  }

  @Post(':id/approve')
  @RequireRole(['manager', 'admin'])
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('id') approvalId: string,
    @Body() body: ApproveApprovalDto,
  ) {
    return this.approvalService.approveApprovalRequest(req.user.id, approvalId, body.poCode);
  }

  @Post(':id/reject')
  @RequireRole(['manager', 'admin'])
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id') approvalId: string,
    @Body() body: RejectApprovalDto,
  ) {
    return this.approvalService.rejectApprovalRequest(req.user.id, approvalId, body.reason);
  }
}
