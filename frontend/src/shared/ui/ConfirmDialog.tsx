import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  // красная кнопка подтверждения – для необратимых действий
  destructive?: boolean
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

// Окно подтверждения опасных действий: отмена и изменение брони не выполняются по одному нажатию
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Назад',
  destructive = false,
  loading = false,
  error,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth transitionDuration={0}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{children}</DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button color="inherit" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={loading}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
