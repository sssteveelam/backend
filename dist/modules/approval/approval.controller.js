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
exports.ApprovalController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const approve_approval_dto_1 = require("./dto/approve-approval.dto");
const reject_approval_dto_1 = require("./dto/reject-approval.dto");
const approval_service_1 = require("./approval.service");
let ApprovalController = class ApprovalController {
    constructor(approvalService) {
        this.approvalService = approvalService;
    }
    list(status) {
        return this.approvalService.listApprovals(status);
    }
    approve(req, approvalId, body) {
        return this.approvalService.approveApprovalRequest(req.user.id, approvalId, body.poCode);
    }
    reject(req, approvalId, body) {
        return this.approvalService.rejectApprovalRequest(req.user.id, approvalId, body.reason);
    }
};
exports.ApprovalController = ApprovalController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApprovalController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, approve_approval_dto_1.ApproveApprovalDto]),
    __metadata("design:returntype", void 0)
], ApprovalController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reject_approval_dto_1.RejectApprovalDto]),
    __metadata("design:returntype", void 0)
], ApprovalController.prototype, "reject", null);
exports.ApprovalController = ApprovalController = __decorate([
    (0, common_1.Controller)('approvals'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [approval_service_1.ApprovalService])
], ApprovalController);
//# sourceMappingURL=approval.controller.js.map