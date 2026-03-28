import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../common/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRole, RolesGuard } from '../auth/guards/roles.guard';
import { AddReceiptLineDto } from './dto/add-receipt-line.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SubmitReceiptDto } from './dto/submit-receipt.dto';
import { ReceiptService } from './receipt.service';
import { ReceiptListQueryDto } from './dto/receipt-list-query.dto';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  // PROPOSED NEW API: list receipts for history/list screens
  @Get()
  @RequireRole(['staff', 'manager', 'admin'])
  list(@Query() query: ReceiptListQueryDto) {
    return this.receiptService.listReceipts(query);
  }

  // PROPOSED NEW API: receipt detail with lines
  @Get(':id')
  @RequireRole(['staff', 'manager', 'admin'])
  detail(@Param('id') receiptId: string) {
    return this.receiptService.getReceiptDetail(receiptId);
  }

  @Post()
  @RequireRole(['staff', 'manager', 'admin'])
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateReceiptDto) {
    return this.receiptService.createReceipt(req.user.id, body);
  }

  @Post(':id/lines')
  @RequireRole(['staff', 'manager', 'admin'])
  addLine(
    @Req() req: AuthenticatedRequest,
    @Param('id') receiptId: string,
    @Body() body: AddReceiptLineDto,
  ) {
    return this.receiptService.addLine(req.user.id, receiptId, body);
  }

  @Post(':id/submit')
  @RequireRole(['staff', 'manager', 'admin'])
  submit(
    @Req() req: AuthenticatedRequest,
    @Param('id') receiptId: string,
    @Body() body: SubmitReceiptDto,
  ) {
    const idempotencyKey = (req as unknown as { headers: Record<string, string | undefined> }).headers['idempotency-key'];
    return this.receiptService.submitReceipt(req.user.id, req.user.role, receiptId, idempotencyKey ?? '', body);
  }

  @Post(':id/cancel')
  @RequireRole(['admin'])
  cancel(@Req() req: AuthenticatedRequest, @Param('id') receiptId: string) {
    return this.receiptService.cancelReceipt(req.user.id, receiptId);
  }
}
