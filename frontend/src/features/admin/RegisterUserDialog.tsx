import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage, useRegisterUserMutation } from '../../shared/api/api'
import type { User } from '../../shared/api/types'
import { ROLE_LABELS } from '../../shared/roles'
import * as v from '../../shared/validation'
import { formPaper } from '../../shared/ui/formPaper'

interface Props {
  open: boolean
  onClose: () => void
}

type Field = 'fullName' | 'email' | 'password'

export function RegisterUserDialog({ open, onClose }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<User['role']>('EMPLOYEE')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [register, { isLoading }] = useRegisterUserMutation()

  const errors: v.Errors<Field> = {
    fullName: v.required(fullName, 'Введите фамилию, имя и отчество сотрудника'),
    email: v.email(email),
    password: v.password(password),
  }
  const shown = (f: Field) => (submitted || touched[f] ? errors[f] : undefined)
  const touch = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    setDone(null)
    if (v.hasErrors(errors)) return
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        department: department.trim() || undefined,
      }).unwrap()
      setDone(`Сотрудник добавлен: теперь он может войти с адресом ${email.trim()}`)
      setFullName('')
      setEmail('')
      setPassword('')
      setDepartment('')
      setSubmitted(false)
      setTouched({})
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={formPaper(submit)}>
      <DialogTitle sx={{ pr: 7 }}>
        Добавить сотрудника
        <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="ФИО"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={touch('fullName')}
            error={Boolean(shown('fullName'))}
            helperText={shown('fullName')}
          />
          <TextField
            label="Email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={touch('email')}
            error={Boolean(shown('email'))}
            helperText={shown('email') ?? 'Этот адрес сотрудник будет вводить при входе'}
          />
          <TextField
            label="Пароль"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={touch('password')}
            error={Boolean(shown('password'))}
            helperText={shown('password') ?? 'Не короче 8 символов; сотрудник сможет войти с ним сразу'}
          />
          <TextField select label="Роль" value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Подразделение" value={department} onChange={(e) => setDepartment(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
          {done && <Alert severity="success">{done}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Закрыть</Button>
        <Button type="submit" variant="contained" disabled={isLoading}>Добавить</Button>
      </DialogActions>
    </Dialog>
  )
}
