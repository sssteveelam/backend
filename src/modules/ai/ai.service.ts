import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { AiFeature } from '@prisma/client';
import { AiQueryDto } from './dto/ai-query.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai?: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  async processAiRequest(actorUserId: string, dto: AiQueryDto) {
    const startTime = Date.now();
    let groundedData: any;
    let prompt: string;

    switch (dto.feature) {
      case AiFeature.REPORT:
        groundedData = await this.getReportData(dto);
        prompt = this.buildReportPrompt(groundedData, dto);
        break;
      case AiFeature.EXPIRY_RISK:
        groundedData = await this.getExpiryRiskData(dto);
        prompt = this.buildExpiryRiskPrompt(groundedData, dto);
        break;
      case AiFeature.FORECAST:
        groundedData = await this.getForecastData(dto);
        prompt = this.buildForecastPrompt(groundedData, dto);
        break;
      default:
        throw new BadRequestException('Feature không hợp lệ');
    }

    if (!groundedData || (Array.isArray(groundedData) && groundedData.length === 0)) {
      return {
        resultMarkdown: '### Insufficient Data\nKhông có đủ dữ liệu để tạo báo cáo AI trong khoảng thời gian này. Vui lòng chọn khoảng thời gian rộng hơn hoặc kiểm tra lại bộ lọc.',
        groundedData: [],
        latencyMs: Date.now() - startTime,
      };
    }

    const resultMarkdown = await this.callOpenAI(prompt);
    const latencyMs = Date.now() - startTime;

    // Save history
    await this.prisma.aiHistory.create({
      data: {
        userId: actorUserId,
        feature: dto.feature,
        filterJson: dto as any,
        resultMarkdown,
        latencyMs,
        tokenUsage: null,
      },
    });

    return {
      resultMarkdown,
      groundedData,
      latencyMs,
    };
  }

  async getHistory(actorUserId: string, limit = 20) {
    return this.prisma.aiHistory.findMany({
      where: { userId: actorUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async getReportData(dto: AiQueryDto) {
    const start = dto.startDate ? new Date(dto.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = dto.endDate ? new Date(dto.endDate) : new Date();

    const receipts = await this.prisma.receiptLine.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        receipt: dto.warehouseId ? { warehouseId: dto.warehouseId } : undefined,
      },
      _sum: { quantityBase: true },
      _count: true,
    });

    const issues = await this.prisma.issueLine.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantityBase: true },
      _count: true,
    });

    const movements = await this.prisma.movementLine.count({
      where: {
        createdAt: { gte: start, lte: end },
        movement: dto.warehouseId ? {
          OR: [
            { fromLocation: { warehouseId: dto.warehouseId } },
            { toLocation: { warehouseId: dto.warehouseId } }
          ]
        } : undefined,
      },
    });

    return {
      period: { start, end },
      metrics: {
        inbound: { totalQty: Number(receipts._sum.quantityBase || 0), transactions: receipts._count },
        outbound: { totalQty: Number(issues._sum.quantityBase || 0), transactions: issues._count },
        internalMovements: movements,
      },
      warehouseId: dto.warehouseId || 'All',
    };
  }

  private async getExpiryRiskData(dto: AiQueryDto) {
    const now = new Date();
    const riskThreshold = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const nearExpiryStock = await this.prisma.stockLine.findMany({
      where: {
        quantityBase: { gt: 0 },
        batch: { expiryDate: { lte: riskThreshold } },
        location: dto.warehouseId ? { warehouseId: dto.warehouseId } : undefined,
      },
      include: {
        product: { select: { name: true, code: true } },
        batch: { select: { expiryDate: true, lotCode: true } },
      },
      orderBy: { batch: { expiryDate: 'asc' } },
      take: 50,
    });

    return nearExpiryStock.map(line => {
      const daysLeft = Math.ceil((line.batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const qty = Number(line.quantityBase);
      
      let severity = 0;
      if (daysLeft <= 0) severity = 100;
      else if (daysLeft <= 30) severity = 80;
      else if (daysLeft <= 60) severity = 50;
      else severity = 20;

      return {
          product: line.product.name,
          sku: line.product.code,
          lot: line.batch.lotCode,
          expiry: line.batch.expiryDate.toISOString().split('T')[0],
          daysLeft,
          quantity: qty,
          severity,
      };
    });
  }

  private async getForecastData(dto: AiQueryDto) {
    if (!dto.productId) return null;

    const historyStart = new Date();
    historyStart.setMonth(historyStart.getMonth() - 6);

    const issues = await this.prisma.issueLine.findMany({
      where: {
        productId: dto.productId,
        createdAt: { gte: historyStart }
      },
      select: {
          quantityBase: true,
          createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (issues.length < 5) return { status: 'insufficient_data', message: 'Cần ít nhất 5 giao dịch xuất kho để dự báo.' };

    const monthlyData: Record<string, number> = {};
    issues.forEach(i => {
        const month = i.createdAt.toISOString().substring(0, 7);
        monthlyData[month] = (monthlyData[month] || 0) + Number(i.quantityBase);
    });

    const months = Object.keys(monthlyData).sort();
    const values = months.map(m => monthlyData[m]);
    
    const avg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(values.length, 3);

    return {
        productId: dto.productId,
        historicalMonthly: monthlyData,
        movingAverage3M: avg,
        totalHistoryTransactions: issues.length,
    };
  }

  private buildReportPrompt(data: any, dto: AiQueryDto) {
    return `Bạn là chuyên gia phân tích kho vận (WMS Analyst). 
Hãy viết báo cáo tóm tắt hoạt động kho dựa trên dữ liệu thật sau đây (grounded JSON):
${JSON.stringify(data, null, 2)}

Yêu cầu:
1. Viết bằng tiếng Việt, định dạng Markdown chuyên nghiệp.
2. Tóm tắt các chỉ số chính (Nhập, Xuất, Tồn).
3. Nhận xét về hiệu suất hoạt động kho trong thời gian qua.
4. Đề xuất 3 hành động thực tế (Action Items) để tối ưu vận hành.
5. KHÔNG được bịa số liệu ngoài JSON cung cấp.`;
  }

  private buildExpiryRiskPrompt(data: any, dto: AiQueryDto) {
    return `Bạn là chuyên gia quản lý hàng tồn kho. 
Dưới đây là danh sách các lô hàng có rủi ro hết hạn (grounded JSON):
${JSON.stringify(data, null, 2)}

Yêu cầu:
1. Viết bằng tiếng Việt, định dạng Markdown.
2. Phân loại mức độ rủi ro (Nghiêm trọng, Cao, Trung bình).
3. Giải thích tại sao một số mặt hàng cần được ưu tiên xử lý ngay.
4. Đề xuất phương án xử lý (vd: Khuyến mãi, Trả hàng, Chuyển kho tiêu thụ gấp).
5. KHÔNG được bịa số liệu. Nếu danh sách trống, hãy trả lời là "Không có rủi ro đáng kể nào hiện tại".`;
  }

  private buildForecastPrompt(data: any, dto: AiQueryDto) {
    if (data.status === 'insufficient_data') {
        return `Người dùng muốn dự báo nhu cầu sản phẩm ${dto.productId} nhưng hệ thống báo: ${data.message}.
Hãy viết một đoạn giải thích ngắn gọn bằng tiếng Việt (Markdown) tại sao chưa thể dự báo và cần người dùng làm gì thêm.`;
    }

    return `Bạn là chuyên gia dự báo nhu cầu (Demand Planner).
Dưới đây là dữ liệu lịch sử xuất kho của sản phẩm:
${JSON.stringify(data, null, 2)}

Yêu cầu:
1. Giải thích xu hướng nhu cầu dựa trên lịch sử tháng (tăng/giảm/ổn định). 
2. Đánh giá con số dự báo (Moving Average) là cao hay thấp so với trung bình.
3. Đưa ra khuyến nghị về mức tồn kho tối thiểu (safety stock) nên duy trì.
4. KHÔNG bịa số liệu. Trả lời bằng tiếng Việt, Markdown.`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.openai) {
      return '### Lỗi Cấu Hình\nOpenAI API Key chưa được thiết lập. Vui lòng liên hệ Admin.';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Bạn là một chuyên gia quản lý kho thông minh.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || '### Phản hồi rỗng\nOpenAI không trả về kết quả.';
    } catch (error) {
      this.logger.error('OpenAI Error:', error);
      return '### Lỗi Kết Nối AI\nKhông thể kết nối tới dịch vụ OpenAI vào lúc này. Vui lòng thử lại sau.';
    }
  }
}
