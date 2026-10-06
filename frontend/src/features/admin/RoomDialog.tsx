import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage, useCreateRoomMutation } from '../../shared/api/api'
import * as v from '../../shared/validation'
import { formPaper } from '../../shared/ui/formPaper'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (roomId: string) => void
}

type Field = 'name' | 'floor' | 'capacity'

export function RoomDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [floor, setFloor] = useState('1')
  const [capacity, setCapacity] = useState('6')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [create, { isLoading }] = useCreateRoomMutation()

  const errors: v.Errors<Field> = {
    name: v.required(name, 'Введите название переговорной, например «Байкал»'),
    floor: v.integerInRange(floor, -5, 100, 'номер этажа'),
    capacity: v.integerInRange(capacity, 1, 500, 'вместимость'),
  }
  const shown = (f: Field) => (submitted ? errors[f] : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (v.hasErrors(errors)) return
    try {
      const room = await create({ name: name.trim(), floor: Number(floor), capacity: Number(capacity) }).unwrap()
      setName('')
      setSubmitted(false)
      onCreated(room.id)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={formPaper(submit)}>
      <DialogTitle sx={{ pr: 7 }}>
        Новая переговорная
        <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Название"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(shown('name'))}
            helperText={shown('name')}
          />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Этаж"
              type="number"
              required
              fullWidth
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              error={Boolean(shown('floor'))}
              helperText={shown('floor')}
            />
            <TextField
              label="Вместимость, чел."
              type="number"
              required
              fullWidth
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              error={Boolean(shown('capacity'))}
              helperText={shown('capacity')}
            />
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button type="submit" variant="contained" disabled={isLoading}>Добавить</Button>
      </DialogActions>
    </Dialog>
  )
}
