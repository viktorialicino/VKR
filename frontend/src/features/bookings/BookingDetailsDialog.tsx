import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../app/store'
import { errorMessage, useCancelBookingMutation } from '../../shared/api/api'
import type { Booking } from '../../shared/api/types'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

interface Props {
  booking: Booking | null
  own: boolean
  onEdit: (booking: Booking) => void
  onClose: () => void
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

// Если бронь переходит через полночь, показываем обе даты
const period = (b: { startTime: string; endTime: string }) =>
  new Date(b.startTime).toDateString() === new Date(b.endTime).toDateString()
    ? `${day(b.startTime)}, ${time(b.startTime)}–${time(b.endTime)}`
    : `${day(b.startTime)}, ${time(b.startTime)} — ${day(b.endTime)}, ${time(b.endTime)}`

export function BookingDetailsDialog({ booking, own, onEdit, onClose }: Props) {
  const [cancelBooking, { isLoading }] = useCancelBookingMutation()
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const role = useSelector((s: RootState) => s.auth.user?.role)
  // Как и на сервере: отменить может автор, офис-менеджер или администратор
  const canCancel = own || role === 'OFFICE_MANAGER' || role === 'ADMIN'
  // завершившуюся встречу изменить нельзя (сервер это тоже проверяет)
  const canEdit = canCancel && booking !== null && new Date(booking.endTime) > new Date()

  const cancel = async () => {
    if (!booking) return
    try {
      await cancelBooking(booking.id).unwrap()
      setConfirmingCancel(false)
      onClose()
    } catch (e) {
      setConfirmingCancel(false)
      setError(errorMessage(e))
    }
  }

  const close = () => {
    setError(null)
    onClose()
  }

  return (
    <Dialog open={Boolean(booking)} onClose={close} fullWidth maxWidth="xs" transitionDuration={0}>
      {booking && (
        <>
          <DialogTitle sx={{ pr: 7 }}>
            {booking.title}
            <IconButton aria-label="Закрыть" onClick={close} sx={{ position: 'absolute', right: 12, top: 12 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              <Row label="Когда">
                {period(booking)}
              </Row>
              <Row label="Комната">{booking.room.name}</Row>
              <Row label="Организатор">{booking.user.fullName}</Row>
              <Row label="Оборудование">
                {booking.resources.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    без оборудования
                  </Typography>
                ) : (
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {booking.resources.map(({ resource }) => (
                      <Chip key={resource.id} size="small" label={resource.name} />
                    ))}
                  </Stack>
                )}
              </Row>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button color="inherit" onClick={close}>
              Закрыть
            </Button>
            {canEdit && (
              <Button variant="outlined" onClick={() => onEdit(booking)}>
                Изменить
              </Button>
            )}
            {canCancel && (
              <Button color="error" variant="outlined" onClick={() => setConfirmingCancel(true)} disabled={isLoading}>
                Отменить бронь
              </Button>
            )}
          </DialogActions>
        </>
      )}
      <ConfirmDialog
        open={confirmingCancel}
        title="Отменить бронь?"
        confirmLabel="Отменить бронь"
        cancelLabel="Не отменять"
        destructive
        loading={isLoading}
        onConfirm={cancel}
        onClose={() => setConfirmingCancel(false)}
      >
        Бронь «{booking?.title}» будет отменена, комната и оборудование освободятся для других сотрудников. Это
        действие нельзя отменить.
      </ConfirmDialog>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, textTransform: 'none' }}>
        {children}
      </Typography>
    </div>
  )
}
