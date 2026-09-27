import { configureStore } from '@reduxjs/toolkit'
import { api } from '../shared/api/api'

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})

export type AppDispatch = typeof store.dispatch
