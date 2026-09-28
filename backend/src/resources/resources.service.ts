import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ResourceAction, ResourceStatus } from '../generated/client.js';
import { ChangeStatusDto, ResourceActionName } from './dto/change-status.dto.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';

// Допустимые переходы: действие -> из каких статусов -> в какой статус + запись в журнал
const TRANSITIONS: Record<
  ResourceActionName,
  { from: ResourceStatus[]; to: ResourceStatus; log: ResourceAction }
> = {
  issue: { from: ['AVAILABLE'], to: 'ISSUED', log: 'ISSUED' },
  return: { from: ['ISSUED', 'IN_REPAIR'], to: 'AVAILABLE', log: 'RETURNED' },
  repair: { from: ['AVAILABLE', 'ISSUED'], to: 'IN_REPAIR', log: 'TO_REPAIR' },
};

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: { status?: ResourceStatus; roomId?: string; from?: Date; to?: Date }) {
    const resources = await this.prisma.resource.findMany({
      where: { status: q.status, roomId: q.roomId },
      orderBy: [{ type: 'asc' }, { inventoryNumber: 'asc' }],
    });
    if (!q.from || !q.to) return resources;

    const taken = await this.prisma.bookingResource.findMany({
      where: { active: true, startTime: { lt: q.to }, endTime: { gt: q.from } },
      select: { resourceId: true },
      distinct: ['resourceId'],
    });
    const busy = new Set(taken.map((t) => t.resourceId));
    return resources.map((r) => ({ ...r, busy: busy.has(r.id) }));
  }

  create(dto: CreateResourceDto) {
    return this.prisma.resource.create({ data: dto });
  }

  history(id: string) {
    return this.prisma.resourceLog.findMany({
      where: { resourceId: id },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Ресурс не найден');

    const t = TRANSITIONS[dto.action];
    if (!t.from.includes(resource.status)) {
      throw new BadRequestException(
        `Действие «${dto.action}» недопустимо для ресурса в статусе ${resource.status}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.resource.update({ where: { id }, data: { status: t.to } }),
      this.prisma.resourceLog.create({
        data: { resourceId: id, userId, action: t.log },
      }),
    ]);
    return updated;
  }
}
