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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const context_service_1 = require("../context/context.service");
const audit_repository_1 = require("./audit.repository");
const list_response_dto_1 = require("../../common/dto/list-response.dto");
const pagination_query_dto_1 = require("../../common/dto/pagination-query.dto");
let AuditService = class AuditService {
    constructor(contextService, auditRepository) {
        this.contextService = contextService;
        this.auditRepository = auditRepository;
    }
    async logEvent(input) {
        const context = this.contextService.get();
        if (!context.actorUserId) {
            throw new Error('AUDIT_ACTOR_USER_ID_REQUIRED');
        }
        if (!context.correlationId) {
            throw new Error('AUDIT_CORRELATION_ID_REQUIRED');
        }
        await this.auditRepository.createEvent({
            actorUserId: context.actorUserId,
            action: input.action,
            entityType: input.entity_type,
            entityId: input.entity_id,
            beforeJson: input.before,
            afterJson: input.after,
            reason: input.reason,
            correlationId: context.correlationId,
        });
    }
    async logSystemEvent(input) {
        await this.auditRepository.createEvent({
            actorUserId: input.actorUserId,
            action: input.action,
            entityType: input.entity_type,
            entityId: input.entity_id,
            beforeJson: input.before,
            afterJson: input.after,
            reason: input.reason,
            correlationId: input.correlationId,
        });
    }
    async listAuditEvents(query) {
        if (query.createdFrom && query.createdTo) {
            const from = new Date(query.createdFrom);
            const to = new Date(query.createdTo);
            if (from > to) {
                throw new common_1.BadRequestException('createdFrom phải nhỏ hơn hoặc bằng createdTo');
            }
        }
        const { skip, take } = (0, pagination_query_dto_1.getPaginationSkipTake)({ page: query.page, limit: query.limit });
        const { rows, total } = await this.auditRepository.listAuditEvents(query, skip, take);
        return (0, list_response_dto_1.buildListResponse)({
            data: rows.map((row) => ({
                id: row.id,
                entityType: row.entityType,
                entityId: row.entityId,
                action: row.action,
                actorUserId: row.actorUserId,
                createdAt: row.createdAt.toISOString(),
                reason: row.reason,
                before: row.beforeJson === client_1.Prisma.JsonNull ? null : row.beforeJson ?? null,
                after: row.afterJson === client_1.Prisma.JsonNull ? null : row.afterJson ?? null,
            })),
            page: query.page,
            limit: query.limit,
            total,
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_service_1.ContextService,
        audit_repository_1.AuditRepository])
], AuditService);
//# sourceMappingURL=audit.service.js.map