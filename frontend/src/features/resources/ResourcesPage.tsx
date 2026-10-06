import AddIcon from '@mui/icons-material/Add'
import BuildIcon from '@mui/icons-material/Build'
import DevicesIcon from '@mui/icons-material/Devices'
import EditNoteIcon from '@mui/icons-material/EditNote'
import HistoryIcon from '@mui/icons-material/History'
import LaptopIcon from '@mui/icons-material/Laptop'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import VideoCallIcon from '@mui/icons-material/VideoCall'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { ElementType } from 'react'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../app/store'
import { errorMessage, useChangeResourceStatusMutation, useGetResourcesQuery } from '../../shared/api/api'
import type { Resource, ResourceActionName, ResourceStatus } from '../../shared/api/types'
import { IssueResourceDialog } from './IssueResourceDialog'
import { ResourceDialog } from './ResourceDialog'
import { ResourceHistoryDialog } from './ResourceHistoryDialog'
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, typeLabel } from './resourceLabels'

const ICONS: Record<string, ElementType> = {
  projector: SlideshowIcon,
  laptop: LaptopIcon,
  vks: VideoCallIcon,
  flipchart: EditNoteIcon,
}

// Какие действия доступны в каждом статусе — те же переходы, что проверяет сервер
const ACTIONS: Record<ResourceStatus, { action: ResourceActionName; label: string }[]> = {
  AVAILABLE: [
    { action: 'issue', label: 'Выдать…' },
    { action: 'repair', label: 'В ремонт' },
  ],
  ISSUED: [
    { action: 'return', label: 'Принять' },
    { action: 'repair', label: 'В ремонт' },
  ],
  IN_REPAIR: [{ action: 'return', label: 'Вернуть в работу' }],
}

export function ResourcesPage() {
  const role = useSelector((s: RootState) => s.auth.user?.role)
  const canManage = role === 'OFFICE_MANAGER' || role === 'ADMIN'

  const [type, setType] = useState('')
  const [status, setStatus] = useState<ResourceStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const [history, setHistory] = useState<Resource | null>(null)
  const [issuing, setIssuing] = useState<Resource | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: all = [], isLoading, error } = useGetResourcesQuery()
  const [changeStatus, { isLoading: changing }] = useChangeResourceStatusMutation()

  const types = [...new Set(all.map((r) => r.type))]
  const shown = all.filter((r) => (!type || r.type === type) && (!status || r.status === status))

  const run = async (id: string, action: ResourceActionName) => {
    setActionError(null)
    try {
      await changeStatus({ id, action }).unwrap()
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.5, alignItems: { md: 'center' } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" component="h2">
            Офисные ресурсы
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Оборудование, которое можно заказать вместе с переговорной, и его текущее состояние
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField select size="small" label="Тип" value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">Все типы</MenuItem>
            {types.map((t) => (
              <MenuItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Статус"
            value={status}
            onChange={(e) => setStatus(e.target.value as ResourceStatus | '')}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Любой</MenuItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              Добавить ресурс
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(error)}</Alert>}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        {shown.map((r) => {
          const Icon = ICONS[r.type] ?? DevicesIcon
          return (
            <Paper key={r.id} variant="outlined" sx={{ p: 2, borderRadius: '18px' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(79,70,229,.08)', color: 'primary.main', flexShrink: 0 }}>
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>{r.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {typeLabel(r.type)} · {r.inventoryNumber}
                  </Typography>
                </Box>
                <Tooltip title="Журнал операций">
                  <IconButton size="small" aria-label="Журнал операций" onClick={() => setHistory(r)}>
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {r.status === 'ISSUED' && r.holder && (
                <Typography variant="body2" sx={{ mt: 1.5 }}>
                  Выдан: <b>{r.holder.fullName}</b>
                </Typography>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                <Chip size="small" color={STATUS_COLORS[r.status]} variant="outlined" label={STATUS_LABELS[r.status]} />
                <Box sx={{ flexGrow: 1 }} />
                {canManage &&
                  ACTIONS[r.status].map(({ action, label }) => (
                    <Button
                      key={action}
                      size="small"
                      variant={action === 'repair' ? 'text' : 'outlined'}
                      color={action === 'repair' ? 'error' : 'primary'}
                      startIcon={action === 'repair' ? <BuildIcon fontSize="small" /> : undefined}
                      disabled={changing}
                      onClick={() => (action === 'issue' ? setIssuing(r) : run(r.id, action))}
                    >
                      {label}
                    </Button>
                  ))}
              </Stack>
            </Paper>
          )
        })}
      </Box>

      {!isLoading && shown.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
          Ресурсов по выбранным условиям нет.
        </Typography>
      )}

      {!canManage && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Выдача, приём и передача в ремонт доступны офис-менеджеру и администратору.
        </Typography>
      )}

      <ResourceDialog open={creating} onClose={() => setCreating(false)} />
      <IssueResourceDialog resource={issuing} onClose={() => setIssuing(null)} />
      <ResourceHistoryDialog resource={history} onClose={() => setHistory(null)} />
    </>
  )
}
