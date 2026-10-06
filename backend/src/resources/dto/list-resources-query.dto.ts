import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ResourceStatus } from '../../generated/client.js';

export class ListResourcesQueryDto {
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  // Если заданы оба, к каждому ресурсу добавляется признак busy — занят ли он на интервале
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  // При изменении брони её собственные назначения не считаются занятостью
  @IsOptional()
  @IsUUID()
  excludeBookingId?: string;
}
