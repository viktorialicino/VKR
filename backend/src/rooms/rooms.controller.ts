import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '../generated/client.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('rooms')
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  findAll(@Query('minCapacity', new ParseIntPipe({ optional: true })) minCapacity?: number) {
    return this.rooms.findAll(minCapacity);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OFFICE_MANAGER, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  @Get(':id/availability')
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() q: AvailabilityQueryDto) {
    return this.rooms.availability(id, q.from, q.to);
  }
}
