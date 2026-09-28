import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BOOKING_RULES } from '../booking-rules.js';

export class CreateBookingDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOKING_RULES.titleMaxLength)
  title!: string;

  @Type(() => Date)
  @IsDate()
  startTime!: Date;

  @Type(() => Date)
  @IsDate()
  endTime!: Date;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  resourceIds?: string[];
}
