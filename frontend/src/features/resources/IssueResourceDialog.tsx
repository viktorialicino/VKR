import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage, useChangeResourceStatusMutation, useGetUsersQuery } from '../../shared/api/api'
import type { Resource, User } from '../../shared/api/types'
import { formPaper } from '../../shared/ui/formPaper'

interface Props {
  resource: Resource | null
  onClose: () => void
}

// Выдача ресурса конкретному сотруднику: выбор получателя обязателен, он фиксируется в журнале
export function IssueResourceDialog({ resource, onClose }: Props) {
  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !resource })
  const [holder, setHolder] = useState<Pick<User, 'id' | 'fullName' | 'department'> | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [change, { isLoading }] = useChangeResourceStatusMutation()

  const close = () => {
    setHolder(null)
    setSubmitted(false)
    setError(null)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (!holder || !resource) return
    try {
      await change({ id: resource.id, action: 'issue', holderId: holder.id }).unwrap()
      close()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={Boolean(resource)} onClose={isLoading ? undefined : close} fullWidth maxWidth="xs" slotProps={formPaper(submit)}>
      <DialogTitle sx={{ pr: 7 }}>
        Выдать ресурс сотруднику
        <IconButton aria-label="Закрыть" onClick={close} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          {resource?.name} · {resource?.inventoryNumber}
        </DialogContentText>
        <Autocomplete
          options={users}
          value={holder}
          onChange={(_, value) => setHolder(value)}
          getOptionLabel={(u) => u.fullName}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="Сотрудник не найден"
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              required
              label="Кому выдать"
              error={submitted && !holder}
              helperText={submitted && !holder ? 'Выберите сотрудника из списка' : 'Начните вводить фамилию'}
            />
          )}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={close} color="inherit" disabled={isLoading}>Отмена</Button>
        <Button type="submit" variant="contained" disabled={isLoading}>Выдать</Button>
      </DialogActions>
    </Dialog>
  )
}
