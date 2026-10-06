import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { errorMessage, useLoginMutation } from '../../shared/api/api'
import * as v from '../../shared/validation'
import { setCredentials } from './authSlice'

export function LoginPage() {
  const dispatch = useDispatch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { isLoading }] = useLoginMutation()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const emailError = v.email(email)
  const passwordError = v.required(password, 'Введите пароль')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (emailError || passwordError) return
    try {
      const result = await login({ email: email.trim(), password }).unwrap()
      dispatch(setCredentials({ token: result.accessToken, user: result.user }))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f8fafc', p: 2 }}>
      <Paper
        component="form"
        noValidate
        onSubmit={submit}
        variant="outlined"
        sx={{ p: 4, width: '100%', maxWidth: 380, borderRadius: '20px' }}
      >
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
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
            error={submitted && Boolean(emailError)}
            helperText={submitted ? emailError : undefined}
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={submitted && Boolean(passwordError)}
            helperText={submitted ? passwordError : undefined}
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
