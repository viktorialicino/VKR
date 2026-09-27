import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const RESOURCE_ACTIONS = ['issue', 'return', 'repair'] as const;
export type ResourceActionName = (typeof RESOURCE_ACTIONS)[number];

export class ChangeStatusDto {
  @IsIn(RESOURCE_ACTIONS)
  action!: ResourceActionName;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
