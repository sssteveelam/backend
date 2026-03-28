"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const confirm_pick_dto_1 = require("./dto/confirm-pick.dto");
const create_issue_dto_1 = require("./dto/create-issue.dto");
const plan_picks_dto_1 = require("./dto/plan-picks.dto");
const issue_service_1 = require("./issue.service");
const picking_service_1 = require("./picking.service");
const issue_list_query_dto_1 = require("./dto/issue-list-query.dto");
const pick_task_list_query_dto_1 = require("./dto/pick-task-list-query.dto");
let IssueController = class IssueController {
    constructor(issueService, pickingService) {
        this.issueService = issueService;
        this.pickingService = pickingService;
    }
    listIssues(query) {
        return this.issueService.listIssues(query);
    }
    getIssueDetail(issueId) {
        return this.issueService.getIssueDetail(issueId);
    }
    listPickTasksByIssue(issueId, query) {
        return this.issueService.listPickTasksByIssue(issueId, query);
    }
    createIssue(req, body) {
        return this.issueService.createIssue(req.user.id, body);
    }
    planPicks(req, issueId, body) {
        return this.issueService.planPicks(req.user.id, issueId, body);
    }
    softReserveIssue(req, issueId) {
        return this.issueService.softReserveIssue(req.user.id, issueId);
    }
    startPicking(req, issueId) {
        return this.issueService.startPicking(req.user.id, issueId);
    }
    confirmPick(req, taskId, body) {
        return this.pickingService.confirmPick(req.user.id, taskId, body);
    }
    getPickTaskSuggestions(req, taskId) {
        return this.pickingService.getSuggestions(req.user.id, taskId);
    }
    completeIssue(req, issueId) {
        return this.issueService.completeIssue(req.user.id, issueId);
    }
    cancelIssue(req, issueId) {
        return this.issueService.cancelIssue(req.user.id, issueId);
    }
};
exports.IssueController = IssueController;
__decorate([
    (0, common_1.Get)('issues'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [issue_list_query_dto_1.IssueListQueryDto]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "listIssues", null);
__decorate([
    (0, common_1.Get)('issues/:id'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "getIssueDetail", null);
__decorate([
    (0, common_1.Get)('issues/:id/pick-tasks'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pick_task_list_query_dto_1.PickTaskListQueryDto]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "listPickTasksByIssue", null);
__decorate([
    (0, common_1.Post)('issues'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_issue_dto_1.CreateIssueDto]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "createIssue", null);
__decorate([
    (0, common_1.Post)('issues/:id/plan-picks'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, plan_picks_dto_1.PlanPicksDto]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "planPicks", null);
__decorate([
    (0, common_1.Post)('issues/:id/soft-reserve'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "softReserveIssue", null);
__decorate([
    (0, common_1.Post)('issues/:id/start-picking'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "startPicking", null);
__decorate([
    (0, common_1.Post)('pick-tasks/:id/confirm'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_pick_dto_1.ConfirmPickDto]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "confirmPick", null);
__decorate([
    (0, common_1.Get)('pick-tasks/:id/suggestions'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "getPickTaskSuggestions", null);
__decorate([
    (0, common_1.Post)('issues/:id/complete'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "completeIssue", null);
__decorate([
    (0, common_1.Post)('issues/:id/cancel'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IssueController.prototype, "cancelIssue", null);
exports.IssueController = IssueController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [issue_service_1.IssueService,
        picking_service_1.PickingService])
], IssueController);
//# sourceMappingURL=issue.controller.js.map