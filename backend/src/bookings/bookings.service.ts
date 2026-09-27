import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validateBookingWindow } from './booking-rules.js';
import { BookingsGateway } from './bookings.gateway.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto.js';

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

  async create(dto: CreateBookingDto) {
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
            userId: dto.userId,
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

  async cancel(id: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Бронь не найдена');
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

  private async toHttpError(e: unknown, dto: CreateBookingDto): Promise<unknown> {
    const text = errorText(e);

    if (text.includes(ROOM_OVERLAP)) {
      const clash = await this.prisma.booking.findFirst({
        where: {
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
