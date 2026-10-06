import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  inventoryNumber!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  // сколько одинаковых единиц завести; при quantity > 1 инвентарный номер служит префиксом (MBP -> MBP-001, MBP-002 ...)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;
}
