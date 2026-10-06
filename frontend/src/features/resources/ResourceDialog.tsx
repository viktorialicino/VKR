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
import { errorMessage, useCreateResourceMutation } from '../../shared/api/api'
import * as v from '../../shared/validation'
import { TYPE_LABELS } from './resourceLabels'
import { formPaper } from '../../shared/ui/formPaper'

interface Props {
  open: boolean
  onClose: () => void
}

type Field = 'name' | 'inventoryNumber' | 'quantity'

export function ResourceDialog({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState('projector')
  const [inventoryNumber, setInventoryNumber] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [create, { isLoading }] = useCreateResourceMutation()

  const count = Number(quantity)
  const several = Number.isInteger(count) && count > 1
  const prefix = inventoryNumber.trim() || 'MBP'

  const errors: v.Errors<Field> = {
    name: v.required(name, 'Введите название, например «MacBook Pro 14»'),
    inventoryNumber: v.required(
      inventoryNumber,
      several ? 'Введите префикс номера, например MBP' : 'Введите инвентарный номер, например MBP-001',
    ),
    quantity: v.integerInRange(quantity, 1, 50, 'количество'),
  }
  const shown = (f: Field) => (submitted ? errors[f] : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (v.hasErrors(errors)) return
    try {
      await create({ name: name.trim(), type, inventoryNumber: inventoryNumber.trim(), quantity: count }).unwrap()
      setName('')
      setInventoryNumber('')
      setQuantity('1')
      setSubmitted(false)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={formPaper(submit)}>
      <DialogTitle sx={{ pr: 7 }}>
        Новый ресурс
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
          <TextField select label="Тип" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Количество"
            type="number"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={Boolean(shown('quantity'))}
            helperText={shown('quantity') ?? 'Сколько одинаковых единиц добавить (до 50)'}
          />
          <TextField
            label={several ? 'Префикс инвентарного номера' : 'Инвентарный номер'}
            required
            value={inventoryNumber}
            onChange={(e) => setInventoryNumber(e.target.value)}
            error={Boolean(shown('inventoryNumber'))}
            helperText={
              shown('inventoryNumber') ??
              (several
                ? `Каждая единица получит свой номер: ${prefix}-001, ${prefix}-002 и так далее`
                : 'Уникальный номер, по которому ресурс отличают от других')
            }
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button type="submit" variant="contained" disabled={isLoading}>
          {several ? `Добавить (${count})` : 'Добавить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
