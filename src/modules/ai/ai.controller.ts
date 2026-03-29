import { Controller, Post, Get, Body, UseGuards, Query, UseInterceptors } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiQueryDto } from './dto/ai-query.dto';
import { RolesGuard, RequireRole } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('report')
  @RequireRole(['manager', 'admin'])
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800) // 30 minutes
  async getAiReport(@GetUser('id') userId: string, @Body() dto: AiQueryDto) {
    dto.feature = 'REPORT' as any;
    return this.aiService.processAiRequest(userId, dto);
  }

  @Post('expiry-risk')
  @RequireRole(['staff', 'manager', 'admin'])
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(600) // 10 minutes
  async getAiExpiryRisk(@GetUser('id') userId: string, @Body() dto: AiQueryDto) {
    dto.feature = 'EXPIRY_RISK' as any;
    return this.aiService.processAiRequest(userId, dto);
  }

  @Post('forecast')
  @RequireRole(['manager', 'admin'])
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600) // 1 hour
  async getAiForecast(@GetUser('id') userId: string, @Body() dto: AiQueryDto) {
    dto.feature = 'FORECAST' as any;
    return this.aiService.processAiRequest(userId, dto);
  }

  @Get('history')
  async getAiHistory(@GetUser('id') userId: string, @Query('limit') limit?: number) {
    return this.aiService.getHistory(userId, limit ? Number(limit) : 20);
  }
}
