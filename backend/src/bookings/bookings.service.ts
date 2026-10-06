import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validateBookingWindow } from './booking-rules.js';
import { BookingsGateway } from './bookings.gateway.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

const BOOKING_INCLUDE = {
  room: true,
  user: { select: { id: true, fullName: true, email: true } },
  resources: { include: { resource: true } },
} satisfies Prisma.BookingInclude;

// Имена ограничений EXCLUDE из миграции — по ним понимаем, что именно заняло
const ROOM_OVERLAP = 'no_overlapping_bookings';
const RESOURCE_OVERLAP = 'no_overlapping_resource_use';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: BookingsGateway,
  ) {}

  findAll(q: ListBookingsQueryDto) {
    return this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        roomId: q.roomId,
        ...(q.to && { startTime: { lt: q.to } }),
        ...(q.from && { endTime: { gt: q.from } }),
      },
      include: BOOKING_INCLUDE,
      orderBy: { startTime: 'asc' },
    });
  }

  async create(dto: CreateBookingDto, userId: string) {
    const problem = validateBookingWindow(dto.startTime, dto.endTime);
    if (problem) throw new BadRequestException(problem);

    const resourceIds = dto.resourceIds ?? [];
    if (resourceIds.length > 0) {
      const broken = await this.prisma.resource.findFirst({
        where: { id: { in: resourceIds }, status: 'IN_REPAIR' },
        select: { name: true },
      });
      if (broken) throw new ConflictException(`Ресурс «${broken.name}» сейчас в ремонте`);
    }

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            roomId: dto.roomId,
            userId,
            title: dto.title,
            startTime: dto.startTime,
            endTime: dto.endTime,
          },
        });
        if (resourceIds.length > 0) {
          await tx.bookingResource.createMany({
            data: resourceIds.map((resourceId) => ({
              bookingId: created.id,
              resourceId,
              startTime: dto.startTime,
              endTime: dto.endTime,
            })),
          });
        }
        return tx.booking.findUniqueOrThrow({ where: { id: created.id }, include: BOOKING_INCLUDE });
      });

      this.gateway.emitCreated(booking);
      return booking;
    } catch (e) {
      throw await this.toHttpError(e, dto);
    }
  }

  async update(id: string, dto: UpdateBookingDto, requester: { id: string; role: Role }) {
    const existing = await this.prisma.booking.findUnique({ where: { id }, include: { resources: true } });
    if (!existing) throw new NotFoundException('Бронь не найдена');
    const canManage = requester.role === 'OFFICE_MANAGER' || requester.role === 'ADMIN';
    if (existing.userId !== requester.id && !canManage) {
      throw new ForbiddenException('Изменить бронь может только её автор или офис-менеджер');
    }
    if (existing.status === 'CANCELLED') throw new BadRequestException('Отменённую бронь изменить нельзя');
    if (existing.endTime <= new Date()) throw new BadRequestException('Завершившуюся бронь изменить нельзя');

    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    // Правило «начало не в прошлом» применяется, только если начало действительно переносят:
    // у уже идущей встречи можно изменить тему, окончание или оборудование
    const startChanged = startTime.getTime() !== existing.startTime.getTime();
    const problem = validateBookingWindow(startTime, endTime, startChanged ? new Date() : existing.startTime);
    if (problem) throw new BadRequestException(problem);

    const currentIds = existing.resources.map((r) => r.resourceId);
    const resourceIds = dto.resourceIds ?? currentIds;
    const added = resourceIds.filter((rid) => !currentIds.includes(rid));
    if (added.length > 0) {
      const broken = await this.prisma.resource.findFirst({
        where: { id: { in: added }, status: 'IN_REPAIR' },
        select: { name: true },
      });
      if (broken) throw new ConflictException(`Ресурс «${broken.name}» сейчас в ремонте`);
    }

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({ where: { id }, data: { title: dto.title, startTime, endTime } });
        // Назначения ресурсов пересоздаются целиком: так новое время и новый набор проверяются
        // ограничением-исключением одинаково, без частично обновлённых строк
        await tx.bookingResource.deleteMany({ where: { bookingId: id } });
        if (resourceIds.length > 0) {
          await tx.bookingResource.createMany({
            data: resourceIds.map((resourceId) => ({ bookingId: id, resourceId, startTime, endTime })),
          });
        }
        return tx.booking.findUniqueOrThrow({ where: { id }, include: BOOKING_INCLUDE });
      });
      this.gateway.emitUpdated(booking);
      return booking;
    } catch (e) {
      throw await this.toHttpError(e, { roomId: existing.roomId, startTime, endTime }, id);
    }
  }

  async cancel(id: string, requester: { id: string; role: Role }) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Бронь не найдена');
    const isOwner = existing.userId === requester.id;
    const canManage = requester.role === 'OFFICE_MANAGER' || requester.role === 'ADMIN';
    if (!isOwner && !canManage) {
      throw new ForbiddenException('Отменить бронь может только её автор или офис-менеджер');
    }
    if (existing.status === 'CANCELLED') return existing;

    const [booking] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: BOOKING_INCLUDE,
      }),
      this.prisma.bookingResource.updateMany({ where: { bookingId: id }, data: { active: false } }),
    ]);
    this.gateway.emitCancelled(booking);
    return booking;
  }

  private async toHttpError(
    e: unknown,
    dto: { roomId: string; startTime: Date; endTime: Date },
    excludeId?: string,
  ): Promise<unknown> {
    const text = errorText(e);

    if (text.includes(ROOM_OVERLAP)) {
      const clash = await this.prisma.booking.findFirst({
        where: {
          id: excludeId ? { not: excludeId } : undefined,
          roomId: dto.roomId,
          status: 'CONFIRMED',
          startTime: { lt: dto.endTime },
          endTime: { gt: dto.startTime },
        },
        select: { startTime: true, endTime: true },
      });
      return new ConflictException({
        message: 'Комната уже забронирована на выбранный интервал',
        conflict: clash,
      });
    }
    if (text.includes(RESOURCE_OVERLAP)) {
      return new ConflictException('Один из выбранных ресурсов уже занят на этот интервал');
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return new BadRequestException('Комната, пользователь или ресурс не найдены');
    }
    return e;
  }
}

function errorText(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur instanceof Error) parts.push(cur.message);
    cur = (cur as { cause?: unknown }).cause;
  }
  return parts.join(' | ');
}
