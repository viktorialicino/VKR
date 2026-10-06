import type { User } from './api/types'

export const ROLE_LABELS: Record<User['role'], string> = {
  EMPLOYEE: 'Сотрудник',
  OFFICE_MANAGER: 'Офис-менеджер',
  ADMIN: 'Администратор',
}
