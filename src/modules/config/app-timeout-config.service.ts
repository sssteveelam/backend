import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TimeoutsDto = {
  softReserveMinutes: number;
  hardLockMinutes: number;
};

@Injectable()
export class AppTimeoutConfigService {
  private static readonly DEFAULT_ID = 'default';
  private static readonly DEFAULT_SOFT = 30;
  private static readonly DEFAULT_HARD = 60;

  constructor(private readonly prisma: PrismaService) {}

  async getTimeouts(): Promise<TimeoutsDto> {
    let row = await this.prisma.appTimeoutConfig.findUnique({
      where: { id: AppTimeoutConfigService.DEFAULT_ID },
    });
    if (!row) {
      row = await this.prisma.appTimeoutConfig.create({
        data: {
          id: AppTimeoutConfigService.DEFAULT_ID,
          softReserveMinutes: AppTimeoutConfigService.DEFAULT_SOFT,
          hardLockMinutes: AppTimeoutConfigService.DEFAULT_HARD,
        },
      });
    }
    return {
      softReserveMinutes: row.softReserveMinutes,
      hardLockMinutes: row.hardLockMinutes,
    };
  }

  async updateTimeouts(input: TimeoutsDto): Promise<TimeoutsDto> {
    const row = await this.prisma.appTimeoutConfig.upsert({
      where: { id: AppTimeoutConfigService.DEFAULT_ID },
      create: {
        id: AppTimeoutConfigService.DEFAULT_ID,
        softReserveMinutes: input.softReserveMinutes,
        hardLockMinutes: input.hardLockMinutes,
      },
      update: {
        softReserveMinutes: input.softReserveMinutes,
        hardLockMinutes: input.hardLockMinutes,
      },
    });
    return {
      softReserveMinutes: row.softReserveMinutes,
      hardLockMinutes: row.hardLockMinutes,
    };
  }
}
