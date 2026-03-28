import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly contextService: ContextService,
  ) {}

  async login(usernameOrEmail: string, password: string): Promise<{
    accessToken: string;
    user: { id: string; username: string; role: UserRole };
  }> {
    const user = await this.usersRepository.findByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      throw new UnauthorizedException('Sai username/email hoặc mật khẩu');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Sai username/email hoặc mật khẩu');
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

  async logout(userId: string): Promise<{ ok: true }> {
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

  async me(userId: string): Promise<{ id: string; username: string; role: UserRole }> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
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

  async registerSeedUser(params: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    status: string;
  }): Promise<void> {
    if (!Object.values(UserRole).includes(params.role)) {
      throw new BadRequestException('Role không hợp lệ');
    }

    const existed = await this.usersRepository.findByUsernameOrEmail(params.username);
    if (existed) {
      throw new ConflictException('Username đã tồn tại');
    }

    const existedByEmail = await this.usersRepository.findByUsernameOrEmail(params.email);
    if (existedByEmail) {
      throw new ConflictException('Email đã tồn tại');
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
}
