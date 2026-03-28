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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditListQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_query_dto_1 = require("../../../common/dto/pagination-query.dto");
function emptyToUndefined(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
class AuditListQueryDto extends pagination_query_dto_1.PaginationQueryDto {
}
exports.AuditListQueryDto = AuditListQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "entityType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "entityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "actorUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "createdFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => emptyToUndefined(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditListQueryDto.prototype, "createdTo", void 0);
//# sourceMappingURL=audit-list-query.dto.js.map