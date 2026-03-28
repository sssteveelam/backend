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
exports.ReceiptController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const add_receipt_line_dto_1 = require("./dto/add-receipt-line.dto");
const create_receipt_dto_1 = require("./dto/create-receipt.dto");
const submit_receipt_dto_1 = require("./dto/submit-receipt.dto");
const receipt_service_1 = require("./receipt.service");
const receipt_list_query_dto_1 = require("./dto/receipt-list-query.dto");
let ReceiptController = class ReceiptController {
    constructor(receiptService) {
        this.receiptService = receiptService;
    }
    list(query) {
        return this.receiptService.listReceipts(query);
    }
    detail(receiptId) {
        return this.receiptService.getReceiptDetail(receiptId);
    }
    create(req, body) {
        return this.receiptService.createReceipt(req.user.id, body);
    }
    addLine(req, receiptId, body) {
        return this.receiptService.addLine(req.user.id, receiptId, body);
    }
    submit(req, receiptId, body) {
        const idempotencyKey = req.headers['idempotency-key'];
        return this.receiptService.submitReceipt(req.user.id, req.user.role, receiptId, idempotencyKey ?? '', body);
    }
    cancel(req, receiptId) {
        return this.receiptService.cancelReceipt(req.user.id, receiptId);
    }
};
exports.ReceiptController = ReceiptController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [receipt_list_query_dto_1.ReceiptListQueryDto]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_receipt_dto_1.CreateReceiptDto]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/lines'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_receipt_line_dto_1.AddReceiptLineDto]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "addLine", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, roles_guard_1.RequireRole)(['staff', 'manager', 'admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, submit_receipt_dto_1.SubmitReceiptDto]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, roles_guard_1.RequireRole)(['admin']),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReceiptController.prototype, "cancel", null);
exports.ReceiptController = ReceiptController = __decorate([
    (0, common_1.Controller)('receipts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [receipt_service_1.ReceiptService])
], ReceiptController);
//# sourceMappingURL=receipt.controller.js.map