import { createApi, fetchBaseQuery, skipToken, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { logout } from '../../features/auth/authSlice'
import type { RootState } from '../../app/store'
import type { Booking, CreateBookingBody, LoginBody, LoginResponse, Resource, Room, User } from './types'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Просроченный/невалидный токен — разлогиниваем, а не показываем сырую 401-ошибку
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiCtx,
  extra,
) => {
  const result = await rawBaseQuery(args, apiCtx, extra)
  if (result.error?.status === 401) apiCtx.dispatch(logout())
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Booking'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginBody>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
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
  useLoginMutation,
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
