import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import { api } from '../shared/api/api'

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth: authReducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})

export type RootState = ReturnType<typeof store.getState>

export type AppDispatch = typeof store.dispatch
