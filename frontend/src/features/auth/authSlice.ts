import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '../../shared/api/types'

export interface AuthState {
  token: string | null
  user: Pick<User, 'id' | 'fullName' | 'email' | 'role'> | null
}

const STORAGE_KEY = 'auth'

function loadInitialState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AuthState
  } catch {
    // приватный режим/заблокированный localStorage — просто начинаем разлогиненными
  }
  return { token: null, user: null }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    setCredentials(state, action: PayloadAction<AuthState>) {
      state.token = action.payload.token
      state.user = action.payload.user
      persist(state)
    },
    logout(state) {
      state.token = null
      state.user = null
      persist(state)
    },
  },
})

function persist(state: AuthState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
