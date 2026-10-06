import type { ResourceLogEntry, ResourceStatus } from '../../shared/api/types'

export const TYPE_LABELS: Record<string, string> = {
  projector: 'Проектор',
  laptop: 'Ноутбук',
  vks: 'Видеоконференцсвязь',
  flipchart: 'Флипчарт',
}

export const STATUS_LABELS: Record<ResourceStatus, string> = {
  AVAILABLE: 'Свободен',
  ISSUED: 'Выдан',
  IN_REPAIR: 'В ремонте',
}

export const STATUS_COLORS: Record<ResourceStatus, 'success' | 'warning' | 'error'> = {
  AVAILABLE: 'success',
  ISSUED: 'warning',
  IN_REPAIR: 'error',
}

export const ACTION_LABELS: Record<ResourceLogEntry['action'], string> = {
  ISSUED: 'Выдан сотруднику',
  RETURNED: 'Возвращён на склад',
  TO_REPAIR: 'Передан в ремонт',
}

export const typeLabel = (type: string) => TYPE_LABELS[type] ?? type
