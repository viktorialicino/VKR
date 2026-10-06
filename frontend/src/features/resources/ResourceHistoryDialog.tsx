import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import { errorMessage, skipToken, useGetResourceHistoryQuery } from '../../shared/api/api'
import type { Resource } from '../../shared/api/types'
import { ACTION_LABELS } from './resourceLabels'

interface Props {
  resource: Resource | null
  onClose: () => void
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ResourceHistoryDialog({ resource, onClose }: Props) {
  const { data = [], error, isLoading } = useGetResourceHistoryQuery(resource ? resource.id : skipToken)

  return (
    <Dialog open={Boolean(resource)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 7 }}>
        Журнал операций
        <Typography variant="body2" color="text.secondary">
          {resource?.name} · {resource?.inventoryNumber}
        </Typography>
        <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{errorMessage(error)}</Alert>}
        {!error && !isLoading && data.length === 0 && (
          <Typography color="text.secondary">Операций с этим ресурсом пока не было.</Typography>
        )}
        <List disablePadding>
          {data.map((e) => (
            <ListItem key={e.id} disableGutters divider>
              <ListItemText
                primary={e.action === 'ISSUED' && e.holder ? `Выдан: ${e.holder.fullName}` : ACTION_LABELS[e.action]}
                secondary={`${formatDateTime(e.createdAt)} · оформил(а): ${e.user?.fullName ?? 'система'}`}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  )
}
