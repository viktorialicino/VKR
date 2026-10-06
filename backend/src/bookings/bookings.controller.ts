import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';

@ApiTags('bookings')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  findAll(@Query() q: ListBookingsQueryDto) {
    return this.bookings.findAll(q);
  }

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: JwtPayload) {
    return this.bookings.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingDto, @CurrentUser() user: JwtPayload) {
    return this.bookings.update(id, dto, { id: user.sub, role: user.role });
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookings.cancel(id, { id: user.sub, role: user.role });
  }
}
