import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { ConfirmPickDto } from './dto/confirm-pick.dto';
import { CreateIssueDto } from './dto/create-issue.dto';
import { PlanPicksDto } from './dto/plan-picks.dto';
import { IssueService } from './issue.service';
import { PickingService } from './picking.service';
import { IssueListQueryDto } from './dto/issue-list-query.dto';
import { PickTaskListQueryDto } from './dto/pick-task-list-query.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssueController {
  constructor(
    private readonly issueService: IssueService,
    private readonly pickingService: PickingService,
  ) {}

  // PROPOSED NEW API: GET /issues
  @Get('issues')
  @RequireRole(['staff', 'manager', 'admin'])
  listIssues(@Query() query: IssueListQueryDto) {
    return this.issueService.listIssues(query);
  }

  // PROPOSED NEW API: GET /issues/:id
  @Get('issues/:id')
  @RequireRole(['staff', 'manager', 'admin'])
  getIssueDetail(@Param('id') issueId: string) {
    return this.issueService.getIssueDetail(issueId);
  }

  // PROPOSED NEW API: GET /issues/:id/pick-tasks
  @Get('issues/:id/pick-tasks')
  @RequireRole(['staff', 'manager', 'admin'])
  listPickTasksByIssue(@Param('id') issueId: string, @Query() query: PickTaskListQueryDto) {
    return this.issueService.listPickTasksByIssue(issueId, query);
  }

  @Post('issues')
  @RequireRole(['staff', 'manager', 'admin'])
  createIssue(@Req() req: AuthenticatedRequest, @Body() body: CreateIssueDto) {
    return this.issueService.createIssue(req.user.id, body);
  }

  @Post('issues/:id/plan-picks')
  @RequireRole(['staff', 'manager', 'admin'])
  planPicks(@Req() req: AuthenticatedRequest, @Param('id') issueId: string, @Body() body: PlanPicksDto) {
    return this.issueService.planPicks(req.user.id, issueId, body);
  }

  @Post('issues/:id/soft-reserve')
  @RequireRole(['staff', 'manager', 'admin'])
  softReserveIssue(@Req() req: AuthenticatedRequest, @Param('id') issueId: string) {
    return this.issueService.softReserveIssue(req.user.id, issueId);
  }

  @Post('issues/:id/start-picking')
  @RequireRole(['staff', 'manager', 'admin'])
  startPicking(@Req() req: AuthenticatedRequest, @Param('id') issueId: string) {
    return this.issueService.startPicking(req.user.id, issueId);
  }

  @Post('pick-tasks/:id/confirm')
  @RequireRole(['staff', 'manager', 'admin'])
  confirmPick(@Req() req: AuthenticatedRequest, @Param('id') taskId: string, @Body() body: ConfirmPickDto) {
    return this.pickingService.confirmPick(req.user.id, taskId, body);
  }

  // PROPOSED NEW API: GET /pick-tasks/:id/suggestions
  @Get('pick-tasks/:id/suggestions')
  @RequireRole(['staff', 'manager', 'admin'])
  getPickTaskSuggestions(@Req() req: AuthenticatedRequest, @Param('id') taskId: string) {
    return this.pickingService.getSuggestions(req.user.id, taskId);
  }

  @Post('issues/:id/complete')
  @RequireRole(['staff', 'manager', 'admin'])
  completeIssue(@Req() req: AuthenticatedRequest, @Param('id') issueId: string) {
    return this.issueService.completeIssue(req.user.id, issueId);
  }

  @Post('issues/:id/cancel')
  @RequireRole(['staff', 'manager', 'admin'])
  cancelIssue(@Req() req: AuthenticatedRequest, @Param('id') issueId: string) {
    return this.issueService.cancelIssue(req.user.id, issueId);
  }
}
