import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/client.js';
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

  async create(dto: CreateRoomDto) {
    try {
      return await this.prisma.room.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Переговорная с таким названием уже существует');
      }
      throw e;
    }
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
