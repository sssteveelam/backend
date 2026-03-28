"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const client_1 = require("@prisma/client");
const users_repository_1 = require("../users/users.repository");
const audit_service_1 = require("../audit/audit.service");
const context_service_1 = require("../context/context.service");
let AuthService = class AuthService {
    constructor(usersRepository, jwtService, auditService, contextService) {
        this.usersRepository = usersRepository;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.contextService = contextService;
    }
    async login(usernameOrEmail, password) {
        const user = await this.usersRepository.findByUsernameOrEmail(usernameOrEmail);
        if (!user) {
            throw new common_1.UnauthorizedException('Sai username/email hoặc mật khẩu');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Sai username/email hoặc mật khẩu');
        }
        const token = await this.jwtService.signAsync({
            sub: user.id,
            username: user.username,
            role: user.role,
        });
        this.contextService.setActorUserId(user.id);
        await this.auditService.logEvent({
            action: 'USER_LOGIN',
            entity_type: 'users',
            entity_id: user.id,
            before: null,
            after: { id: user.id, username: user.username, role: user.role },
            reason: 'User login success',
        });
        return {
            accessToken: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        };
    }
    async logout(userId) {
        this.contextService.setActorUserId(userId);
        await this.auditService.logEvent({
            action: 'USER_LOGOUT',
            entity_type: 'users',
            entity_id: userId,
            before: null,
            after: null,
            reason: 'User logout',
        });
        return { ok: true };
    }
    async me(userId) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new common_1.UnauthorizedException('Token không hợp lệ');
        }
        this.contextService.setActorUserId(user.id);
        await this.auditService.logEvent({
            action: 'USER_VIEW_ME',
            entity_type: 'users',
            entity_id: user.id,
            before: null,
            after: { id: user.id, username: user.username, role: user.role },
            reason: 'View me',
        });
        return {
            id: user.id,
            username: user.username,
            role: user.role,
        };
    }
    async registerSeedUser(params) {
        if (!Object.values(client_1.UserRole).includes(params.role)) {
            throw new common_1.BadRequestException('Role không hợp lệ');
        }
        const existed = await this.usersRepository.findByUsernameOrEmail(params.username);
        if (existed) {
            throw new common_1.ConflictException('Username đã tồn tại');
        }
        const existedByEmail = await this.usersRepository.findByUsernameOrEmail(params.email);
        if (existedByEmail) {
            throw new common_1.ConflictException('Email đã tồn tại');
        }
        const passwordHash = await bcrypt.hash(params.password, 10);
        await this.usersRepository.create({
            username: params.username,
            email: params.email,
            passwordHash,
            role: params.role,
            status: params.status,
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository,
        jwt_1.JwtService,
        audit_service_1.AuditService,
        context_service_1.ContextService])
], AuthService);
//# sourceMappingURL=auth.service.js.map