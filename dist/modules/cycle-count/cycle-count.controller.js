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
exports.CycleCountController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const add_cycle_count_line_dto_1 = require("./dto/add-cycle-count-line.dto");
const create_cycle_count_dto_1 = require("./dto/create-cycle-count.dto");
const cycle_count_list_query_dto_1 = require("./dto/cycle-count-list-query.dto");
const submit_cycle_count_dto_1 = require("./dto/submit-cycle-count.dto");
const cycle_count_service_1 = require("./cycle-count.service");
let CycleCountController = class CycleCountController {
    constructor(cycleCountService) {
        this.cycleCountService = cycleCountService;
    }
    list(query) {
        return this.cycleCountService.listCycleCounts(query);
    }
    detail(cycleCountId) {
        return this.cycleCountService.getCycleCountDetail(cycleCountId);
    }
    create(req, body) {
        return this.cycleCountService.create(req.user.id, body);
    }
    addLine(req, cycleCountId, body) {
        return this.cycleCountService.addLine(req.user.id, cycleCountId, body);
    }
    submit(req, cycleCountId, body) {
        return this.cycleCountService.submit(req.user.id, cycleCountId, body);
    }
};
exports.CycleCountController = CycleCountController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cycle_count_list_query_dto_1.CycleCountListQueryDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_cycle_count_dto_1.CreateCycleCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/lines'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_cycle_count_line_dto_1.AddCycleCountLineDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "addLine", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, roles_guard_1.RequireRole)(['manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, submit_cycle_count_dto_1.SubmitCycleCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountController.prototype, "submit", null);
exports.CycleCountController = CycleCountController = __decorate([
    (0, common_1.Controller)('cycle-counts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [cycle_count_service_1.CycleCountService])
], CycleCountController);
//# sourceMappingURL=cycle-count.controller.js.map