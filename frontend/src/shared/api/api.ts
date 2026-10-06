import { createApi, fetchBaseQuery, skipToken, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { logout } from '../../features/auth/authSlice'
import type { RootState } from '../../app/store'
import type {
  Booking,
  CreateBookingBody,
  CreateResourceBody,
  CreateRoomBody,
  LoginBody,
  LoginResponse,
  RegisterBody,
  Resource,
  ResourceActionName,
  ResourceLogEntry,
  ResourceStatus,
  Room,
  UpdateBookingBody,
  User,
} from './types'

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
  tagTypes: ['Booking', 'Resource', 'Room'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginBody>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    getUsers: builder.query<User[], void>({ query: () => '/users' }),
    getRooms: builder.query<Room[], void>({ query: () => '/rooms', providesTags: ['Room'] }),
    createRoom: builder.mutation<Room, CreateRoomBody>({
      query: (body) => ({ url: '/rooms', method: 'POST', body }),
      invalidatesTags: ['Room'],
    }),
    registerUser: builder.mutation<User, RegisterBody>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    getResources: builder.query<
      Resource[],
      { from?: string; to?: string; status?: ResourceStatus; excludeBookingId?: string } | void
    >({
      query: (params) => ({ url: '/resources', params: params ?? undefined }),
      providesTags: ['Booking', 'Resource'],
    }),
    createResource: builder.mutation<Resource[], CreateResourceBody>({
      query: (body) => ({ url: '/resources', method: 'POST', body }),
      invalidatesTags: ['Resource'],
    }),
    changeResourceStatus: builder.mutation<Resource, { id: string; action: ResourceActionName; holderId?: string }>({
      query: ({ id, action, holderId }) => ({ url: `/resources/${id}/status`, method: 'PATCH', body: { action, holderId } }),
      invalidatesTags: ['Resource'],
    }),
    getResourceHistory: builder.query<ResourceLogEntry[], string>({
      query: (id) => `/resources/${id}/history`,
      providesTags: ['Resource'],
    }),
    getBookings: builder.query<Booking[], { roomId: string; from: string; to: string }>({
      query: (params) => ({ url: '/bookings', params }),
      providesTags: ['Booking'],
    }),
    createBooking: builder.mutation<Booking, CreateBookingBody>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Booking'],
    }),
    updateBooking: builder.mutation<Booking, { id: string; body: UpdateBookingBody }>({
      query: ({ id, body }) => ({ url: `/bookings/${id}`, method: 'PATCH', body }),
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
  useCreateRoomMutation,
  useRegisterUserMutation,
  useGetResourcesQuery,
  useCreateResourceMutation,
  useChangeResourceStatusMutation,
  useGetResourceHistoryQuery,
  useGetBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useCancelBookingMutation,
} = api

export { skipToken }

export function errorMessage(error: unknown): string {
  const data = (error as { data?: { message?: string | string[] } })?.data
  if (Array.isArray(data?.message)) return data.message.join('; ')
  return data?.message ?? 'Не удалось выполнить запрос'
}
