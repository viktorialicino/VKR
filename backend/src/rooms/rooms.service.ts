import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(minCapacity?: number) {
    return this.prisma.room.findMany({
      where: minCapacity ? { capacity: { gte: minCapacity } } : undefined,
      include: { resources: true },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    });
  }

  create(dto: CreateRoomDto) {
    return this.prisma.room.create({ data: dto });
  }

  async availability(roomId: string, from: Date, to: Date) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Комната не найдена');

    const busy = await this.prisma.booking.findMany({
      where: { roomId, status: 'CONFIRMED', startTime: { lt: to }, endTime: { gt: from } },
      select: { id: true, title: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });
    return { room, from, to, busy };
  }
}
