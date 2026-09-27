import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  findAll(@Query('minCapacity', new ParseIntPipe({ optional: true })) minCapacity?: number) {
    return this.rooms.findAll(minCapacity);
  }

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  @Get(':id/availability')
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() q: AvailabilityQueryDto) {
    return this.rooms.availability(id, q.from, q.to);
  }
}
