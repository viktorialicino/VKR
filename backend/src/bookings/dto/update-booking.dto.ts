import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BOOKING_RULES } from '../booking-rules.js';

// Все поля необязательны: передаются только те, что меняются. Комнату изменить нельзя –
// для переноса в другую комнату бронь отменяют и создают заново.
export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOKING_RULES.titleMaxLength)
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startTime?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  // Полный новый набор оборудования (пустой массив – снять всё); если не передан – набор не меняется
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  resourceIds?: string[];
}
