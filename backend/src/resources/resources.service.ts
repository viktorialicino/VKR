import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/client.js';
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

  async findAll(q: { status?: ResourceStatus; roomId?: string; from?: Date; to?: Date; excludeBookingId?: string }) {
    const resources = await this.prisma.resource.findMany({
      where: { status: q.status, roomId: q.roomId },
      include: { holder: { select: { id: true, fullName: true } } },
      orderBy: [{ type: 'asc' }, { inventoryNumber: 'asc' }],
    });
    if (!q.from || !q.to) return resources;

    const taken = await this.prisma.bookingResource.findMany({
      where: {
        active: true,
        startTime: { lt: q.to },
        endTime: { gt: q.from },
        ...(q.excludeBookingId && { bookingId: { not: q.excludeBookingId } }),
      },
      select: { resourceId: true },
      distinct: ['resourceId'],
    });
    const busy = new Set(taken.map((t) => t.resourceId));
    return resources.map((r) => ({ ...r, busy: busy.has(r.id) }));
  }

  /** Создаёт одну или несколько одинаковых единиц; всегда возвращает массив созданных ресурсов. */
  async create(dto: CreateResourceDto) {
    const { quantity = 1, ...data } = dto;
    try {
      if (quantity === 1) return [await this.prisma.resource.create({ data })];

      // продолжаем нумерацию: если MBP-001 и MBP-002 уже есть, новые получат MBP-003 и далее
      const prefix = data.inventoryNumber;
      const existing = await this.prisma.resource.findMany({
        where: { inventoryNumber: { startsWith: `${prefix}-` } },
        select: { inventoryNumber: true },
      });
      const used = existing
        .map((r) => r.inventoryNumber.slice(prefix.length + 1))
        .filter((tail) => /^\d+$/.test(tail))
        .map(Number);
      const first = Math.max(0, ...used) + 1;
      return await this.prisma.$transaction(
        Array.from({ length: quantity }, (_, i) =>
          this.prisma.resource.create({
            data: { ...data, inventoryNumber: `${prefix}-${String(first + i).padStart(3, '0')}` },
          }),
        ),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ресурс с таким инвентарным номером уже зарегистрирован');
      }
      throw e;
    }
  }

  history(id: string) {
    return this.prisma.resourceLog.findMany({
      where: { resourceId: id },
      include: {
        user: { select: { id: true, fullName: true } },
        holder: { select: { id: true, fullName: true } },
      },
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

    // ресурс выдаётся конкретному сотруднику; при возврате и ремонте закрепление снимается
    let holderId: string | null = null;
    if (dto.action === 'issue') {
      if (!dto.holderId) throw new BadRequestException('Укажите сотрудника, которому выдаётся ресурс');
      const holder = await this.prisma.user.findUnique({ where: { id: dto.holderId }, select: { id: true } });
      if (!holder) throw new NotFoundException('Сотрудник не найден');
      holderId = holder.id;
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.resource.update({
        where: { id },
        data: { status: t.to, holderId },
        include: { holder: { select: { id: true, fullName: true } } },
      }),
      this.prisma.resourceLog.create({
        data: { resourceId: id, userId, holderId, action: t.log },
      }),
    ]);
    return updated;
  }
}
