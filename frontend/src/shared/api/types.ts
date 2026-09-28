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
