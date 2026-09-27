import { createApi, fetchBaseQuery, skipToken } from '@reduxjs/toolkit/query/react'
import type { Booking, CreateBookingBody, Resource, Room, User } from './types'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Booking'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({ query: () => '/users' }),
    getRooms: builder.query<Room[], void>({ query: () => '/rooms' }),
    getResources: builder.query<Resource[], { from: string; to: string } | void>({
      query: (params) => ({ url: '/resources', params: params ?? undefined }),
      providesTags: ['Booking'],
    }),
    getBookings: builder.query<Booking[], { roomId: string; from: string; to: string }>({
      query: (params) => ({ url: '/bookings', params }),
      providesTags: ['Booking'],
    }),
    createBooking: builder.mutation<Booking, CreateBookingBody>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Booking'],
    }),
    cancelBooking: builder.mutation<Booking, string>({
      query: (id) => ({ url: `/bookings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Booking'],
    }),
  }),
})

export const {
  useGetUsersQuery,
  useGetRoomsQuery,
  useGetResourcesQuery,
  useGetBookingsQuery,
  useCreateBookingMutation,
  useCancelBookingMutation,
} = api

export { skipToken }

export function errorMessage(error: unknown): string {
  const data = (error as { data?: { message?: string | string[] } })?.data
  if (Array.isArray(data?.message)) return data.message.join('; ')
  return data?.message ?? 'Не удалось выполнить запрос'
}
