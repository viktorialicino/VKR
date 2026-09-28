import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsGateway } from './bookings.gateway.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsGateway],
})
export class BookingsModule {}
