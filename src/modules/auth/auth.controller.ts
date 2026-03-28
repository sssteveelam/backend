import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, RequireRole } from './guards/roles.guard';

interface AuthenticatedRequest {
  user: { id: string; username: string; role: 'staff' | 'manager' | 'admin' };
}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() body: LoginDto): Promise<{
    accessToken: string;
    user: { id: string; username: string; role: 'staff' | 'manager' | 'admin' };
  }> {
    return this.authService.login(body.usernameOrEmail, body.password);
  }

  @Post('auth/logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest): Promise<{ ok: true }> {
    return this.authService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRole(['staff', 'manager', 'admin'])
  async me(@Req() req: AuthenticatedRequest): Promise<{
    id: string;
    username: string;
    role: string;
  }> {
    return this.authService.me(req.user.id);
  }
}
