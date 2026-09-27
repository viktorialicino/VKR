import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EventIcon from '@mui/icons-material/Event'
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  MenuItem,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'

export type ViewId = 'timeGridDay' | 'timeGridThreeDay' | 'timeGridWeek' | 'dayGridMonth' | 'multiMonthYear'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

interface Props {
  title: string
  view: string
  compact: boolean
  current: Date
  loading: boolean
  onView: (view: ViewId) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onJump: (date: Date) => void
  onNew: () => void
}

export function CalendarToolbar({ title, view, compact, current, loading, onView, onPrev, onNext, onToday, onJump, onNew }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const views: { id: ViewId; label: string }[] = [
    { id: 'timeGridDay', label: 'День' },
    compact ? { id: 'timeGridThreeDay', label: '3 дня' } : { id: 'timeGridWeek', label: 'Неделя' },
    { id: 'dayGridMonth', label: 'Месяц' },
    { id: 'multiMonthYear', label: 'Год' },
  ]

  const titleText = (
    <Typography
      component="h2"
      sx={{
        flexGrow: 1,
        minWidth: 0,
        fontWeight: 700,
        fontSize: { xs: '1.1rem', sm: '1.15rem' },
        '&::first-letter': { textTransform: 'uppercase' },
      }}
      noWrap
    >
      {title}
    </Typography>
  )

  const jumpButton = (
    <Tooltip title="Перейти к дате, месяцу или году">
      <IconButton aria-label="Перейти к дате" onClick={(e) => setAnchor(e.currentTarget)} sx={{ border: 1, borderColor: 'divider' }}>
        <EventIcon />
      </IconButton>
    </Tooltip>
  )

  const viewSwitch = (
    <ToggleButtonGroup
      exclusive
      fullWidth={compact}
      size="small"
      value={view}
      onChange={(_, v: ViewId | null) => v && onView(v)}
      aria-label="Режим календаря"
      sx={{
        alignSelf: { sm: 'flex-start' },
        bgcolor: '#f1f2f9',
        p: 0.5,
        borderRadius: '12px',
        gap: 0.5,
        '& .MuiToggleButtonGroup-grouped': { border: 0, borderRadius: '10px !important' },
      }}
    >
      {views.map((v) => (
        <ToggleButton
          key={v.id}
          value={v.id}
          sx={{ px: { xs: 1, sm: 2 }, py: { xs: 0.9, sm: 0.6 }, '&.Mui-selected': { bgcolor: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.12)' } }}
        >
          {v.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )

  return (
    <Box sx={{ position: 'relative' }}>
      {compact ? (
        <Stack spacing={1.25} sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {titleText}
            {jumpButton}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button aria-label="Назад" variant="outlined" color="inherit" onClick={onPrev} sx={{ flex: 1, minHeight: 42, borderColor: 'divider' }}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="outlined" color="inherit" onClick={onToday} sx={{ flex: 2, minHeight: 42, borderColor: 'divider' }}>
              Сегодня
            </Button>
            <Button aria-label="Вперёд" variant="outlined" color="inherit" onClick={onNext} sx={{ flex: 1, minHeight: 42, borderColor: 'divider' }}>
              <ChevronRightIcon />
            </Button>
          </Stack>
          {viewSwitch}
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <IconButton aria-label="Назад" onClick={onPrev} size="small" sx={{ border: 1, borderColor: 'divider' }}>
                <ChevronLeftIcon />
              </IconButton>
              <IconButton aria-label="Вперёд" onClick={onNext} size="small" sx={{ border: 1, borderColor: 'divider' }}>
                <ChevronRightIcon />
              </IconButton>
            </Stack>
            <Button onClick={onToday} size="small" variant="outlined" color="inherit" sx={{ borderColor: 'divider', minWidth: 0, px: 1.5 }}>
              Сегодня
            </Button>
            {titleText}
            {jumpButton}
            <Button variant="contained" startIcon={<AddIcon />} onClick={onNew} sx={{ whiteSpace: 'nowrap' }}>
              Новая бронь
            </Button>
          </Stack>
          {viewSwitch}
        </Stack>
      )}

      {loading && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 }} />}

      <JumpPopover anchor={anchor} current={current} onClose={() => setAnchor(null)} onJump={(d) => { setAnchor(null); onJump(d) }} />
    </Box>
  )
}

interface JumpProps {
  anchor: HTMLElement | null
  current: Date
  onClose: () => void
  onJump: (date: Date) => void
}

function JumpPopover({ anchor, current, onClose, onJump }: JumpProps) {
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => thisYear - 2 + i)
  const [month, setMonth] = useState(current.getMonth())
  const [year, setYear] = useState(current.getFullYear())

  // при каждом открытии показываем то, на чём сейчас стоит календарь
  const sync = () => {
    setMonth(current.getMonth())
    setYear(current.getFullYear())
  }

  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      slotProps={{ transition: { onEnter: sync }, paper: { sx: { p: 2, mt: 1, width: 300, maxWidth: 'calc(100vw - 32px)', borderRadius: '16px' } } }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle2">Месяц и год</Typography>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Месяц" value={month} onChange={(e) => setMonth(Number(e.target.value))} fullWidth>
            {MONTHS.map((m, i) => (
              <MenuItem key={m} value={i}>{m}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Год" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {years.map((y) => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
        </Stack>
        <Button variant="contained" onClick={() => onJump(new Date(year, month, 1))}>
          Показать
        </Button>

        <Typography variant="subtitle2" sx={{ pt: 1 }}>Или конкретный день</Typography>
        <TextField
          type="date"
          size="small"
          onChange={(e) => e.target.value && onJump(new Date(`${e.target.value}T00:00:00`))}
          slotProps={{ htmlInput: { 'aria-label': 'Дата' } }}
        />
      </Stack>
    </Popover>
  )
}
