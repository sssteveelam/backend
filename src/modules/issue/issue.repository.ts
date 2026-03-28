import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IssueListQueryDto } from './dto/issue-list-query.dto';
import { PickTaskListQueryDto } from './dto/pick-task-list-query.dto';

@Injectable()
export class IssueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listIssues(query: IssueListQueryDto, skip: number, take: number) {
    const where: Prisma.IssueWhereInput = {
      ...(query.status ? { status: query.status } : null),
      ...(query.code ? { code: { contains: query.code, mode: 'insensitive' } } : null),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : null),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : null),
            },
          }
        : null),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { rows, total };
  }

  findIssueWithLinesById(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async listPickTasksByIssue(issueId: string, query: PickTaskListQueryDto, skip: number, take: number) {
    const where: Prisma.PickTaskWhereInput = {
      issueLine: {
        issueId,
      },
      ...(query.status ? { status: query.status } : null),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pickTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.pickTask.count({ where }),
    ]);

    return { rows, total };
  }

  withTransaction<T>(
    callback: (
      tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => callback(tx));
  }
}
