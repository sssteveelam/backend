"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildListResponse = buildListResponse;
function buildListResponse(input) {
    const { data, page, limit, total } = input;
    const totalPages = total <= 0 ? 0 : Math.ceil(total / limit);
    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages,
        },
    };
}
//# sourceMappingURL=list-response.dto.js.map