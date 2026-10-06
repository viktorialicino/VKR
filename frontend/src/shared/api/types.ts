export type ResourceStatus = 'AVAILABLE' | 'ISSUED' | 'IN_REPAIR'

export interface User {
  id: string
  fullName: string
  email: string
  role: 'EMPLOYEE' | 'OFFICE_MANAGER' | 'ADMIN'
  department: string | null
}

export interface Resource {
  id: string
  name: string
  type: string
  inventoryNumber: string
  status: ResourceStatus
  roomId: string | null
  // сотрудник, которому выдан ресурс (только в статусе «Выдан»)
  holder?: { id: string; fullName: string } | null
  // приходит, только если запрошены from/to: занят ли ресурс на этот интервал
  busy?: boolean
}

export interface Room {
  id: string
  name: string
  floor: number
  capacity: number
}

export interface Booking {
  id: string
  roomId: string
  userId: string
  title: string
  startTime: string
  endTime: string
  status: 'CONFIRMED' | 'CANCELLED'
  room: Room
  user: Pick<User, 'id' | 'fullName' | 'email'>
  resources: { resource: Resource }[]
}

export interface CreateBookingBody {
  roomId: string
  title: string
  startTime: string
  endTime: string
  resourceIds: string[]
}

export interface LoginBody {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: Pick<User, 'id' | 'fullName' | 'email' | 'role'>
}

export type ResourceActionName = 'issue' | 'return' | 'repair'

export interface ResourceLogEntry {
  id: string
  resourceId: string
  action: 'ISSUED' | 'RETURNED' | 'TO_REPAIR'
  createdAt: string
  user: { id: string; fullName: string } | null
  // для записи о выдаче – получатель ресурса
  holder: { id: string; fullName: string } | null
}

export interface CreateResourceBody {
  name: string
  type: string
  inventoryNumber: string
  // сколько одинаковых единиц завести; при quantity > 1 номер служит префиксом (MBP -> MBP-001, MBP-002)
  quantity?: number
}

export interface CreateRoomBody {
  name: string
  floor: number
  capacity: number
}

export interface RegisterBody {
  fullName: string
  email: string
  password: string
  role: User['role']
  department?: string
}

export interface UpdateBookingBody {
  title?: string
  startTime?: string
  endTime?: string
  // полный новый набор оборудования; пустой массив снимает всё
  resourceIds?: string[]
}
