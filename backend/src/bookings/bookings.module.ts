import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsGateway } from './bookings.gateway.js';
import { BookingsService } from './bookings.service.js';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, BookingsGateway],
})
export class BookingsModule {}
