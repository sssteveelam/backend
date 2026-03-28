import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ContextService } from '../context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationService } from '../reservation/reservation.service';
import { ConfirmPickDto } from './dto/confirm-pick.dto';
import { PickTaskSuggestionDto } from './dto/pick-task-suggestion.dto';

@Injectable()
export class PickingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
    private readonly contextService: ContextService,
    private readonly auditService: AuditService,
  ) {}

  async getSuggestions(actorUserId: string, taskId: string): Promise<PickTaskSuggestionDto> {
    this.contextService.setActorUserId(actorUserId);

    const task = await this.prisma.pickTask.findUnique({
      where: { id: taskId },
      include: {
        location: true,
        container: true,
        batch: true,
        product: true,
      },
    });

    if (!task) throw new NotFoundException('Pick task không tồn tại');

    const requiresContainer = Boolean(task.containerId);

    return {
      pickTaskId: task.id,
      scanSequenceRecommended: requiresContainer ? ['location', 'container'] : ['location'],
      expected: {
        locationId: task.locationId,
        locationQrCode: task.location.code,
        containerId: task.containerId,
        containerQrCode: task.container?.qrCode || null,
        batchId: task.batchId,
        batchLotCode: task.batch.lotCode,
        productId: task.productId,
      },
      hints: {
        requiresContainerScan: requiresContainer,
        requiresLocationScan: true,
        allowMissingContainer: false, // Default business rule
      },
    };
  }

  async confirmPick(actorUserId: string, taskId: string, dto: ConfirmPickDto) {
/* ... */
    this.contextService.setActorUserId(actorUserId);

    const task = await this.prisma.pickTask.findUnique({
      where: { id: taskId },
      include: {
        location: true,
        container: true,
        reservation: true,
      },
    });
    if (!task) throw new NotFoundException('Pick task không tồn tại');
    if (!task.reservationId || !task.reservation) {
      throw new ConflictException('Pick task chưa có reservation');
    }
    if (task.reservation.status !== 'hard_locked') {
      throw new ConflictException('Chỉ được pick khi reservation hard_locked');
    }
    if (task.status === 'done') {
      throw new ConflictException('Pick task đã done');
    }

    this.validateScanOrder(dto.scanSequence, Boolean(task.containerId));
    if (dto.scannedLocationQr !== task.location.code) {
      throw new BadRequestException('INVALID_SCAN_ORDER');
    }
    if (task.containerId) {
      if (!dto.scannedContainerQr || dto.scannedContainerQr !== task.container?.qrCode) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
      }
    }

    if (task.containerId && task.container?.isSealed) {
      const containerTotal = await this.prisma.stockLine.aggregate({
        where: { containerId: task.containerId },
        _sum: { quantityBase: true },
      });
      const totalQty = Number(containerTotal._sum.quantityBase ?? 0);
      const nextPickedCheck = Number(new Prisma.Decimal(task.pickedQuantity).plus(dto.pickedQuantity));
      const taskQty = Number(task.quantityBase);
      if (
        totalQty <= 0 ||
        Math.abs(taskQty - totalQty) > 0.000001 ||
        Math.abs(nextPickedCheck - totalQty) > 0.000001
      ) {
        throw new ConflictException('CONTAINER_SEALED_PARTIAL_PICK_NOT_ALLOWED');
      }
    }

    const nextPicked = new Prisma.Decimal(task.pickedQuantity).plus(dto.pickedQuantity);
    if (nextPicked.gt(task.quantityBase)) {
      throw new ConflictException('PICK_EXCEEDS_TASK_QUANTITY');
    }

    const updated = await this.prisma.pickTask.update({
      where: { id: task.id },
      data: {
        pickedQuantity: nextPicked,
        status: nextPicked.eq(task.quantityBase) ? 'done' : 'picking',
      },
    });

    await this.reservationService.updateActivity(actorUserId, task.reservationId, 'update picked quantity');

    await this.auditService.logEvent({
      action: 'CONFIRM_PICK',
      entity_type: 'pick_tasks',
      entity_id: task.id,
      before: task as unknown as Prisma.InputJsonValue,
      after: updated as unknown as Prisma.InputJsonValue,
      reason: 'Confirm picked quantity',
    });

    return updated;
  }

  private validateScanOrder(scanSequence: string[], requiresContainer: boolean) {
    if (requiresContainer) {
      if (
        !Array.isArray(scanSequence) ||
        scanSequence.length !== 2 ||
        scanSequence[0] !== 'location' ||
        scanSequence[1] !== 'container'
      ) {
        throw new BadRequestException('INVALID_SCAN_ORDER');
      }
      return;
    }

    if (
      !Array.isArray(scanSequence) ||
      scanSequence.length !== 1 ||
      scanSequence[0] !== 'location'
    ) {
      throw new BadRequestException('INVALID_SCAN_ORDER');
    }
  }
}
