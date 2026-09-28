import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { errorMessage, useLoginMutation } from '../../shared/api/api'
import { setCredentials } from './authSlice'

export function LoginPage() {
  const dispatch = useDispatch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { isLoading }] = useLoginMutation()
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await login({ email, password }).unwrap()
      dispatch(setCredentials({ token: result.accessToken, user: result.user }))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f8fafc', p: 2 }}>
      <Paper
        component="form"
        onSubmit={submit}
        variant="outlined"
        sx={{ p: 4, width: '100%', maxWidth: 380, borderRadius: '20px' }}
      >
        <Stack spacing={2.5} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg,#6366f1,#4338ca)',
            }}
          >
            <LockOutlinedIcon />
          </Box>
          <Typography variant="h6" component="h1">
            Вход в систему бронирования
          </Typography>

          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          )}

          <Button type="submit" variant="contained" size="large" fullWidth disabled={isLoading}>
            Войти
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
