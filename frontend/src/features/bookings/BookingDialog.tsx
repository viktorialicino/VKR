import CloseIcon from '@mui/icons-material/Close'
import DevicesIcon from '@mui/icons-material/Devices'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LaptopIcon from '@mui/icons-material/Laptop'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import VideoCallIcon from '@mui/icons-material/VideoCall'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import type { ElementType } from 'react'
import { useState } from 'react'
import { errorMessage, skipToken, useCreateBookingMutation, useGetResourcesQuery } from '../../shared/api/api'
import type { Resource } from '../../shared/api/types'
import {
  RULES,
  endTimeOptions,
  formatDuration,
  parseLocal,
  rangeFromSlot,
  shiftRange,
  startTimeOptions,
  toDateStr,
  validateForm,
  type FormValues,
} from './bookingRules'

export interface Slot {
  start: Date
  end: Date
}

interface Props {
  open: boolean
  slot: Slot | null
  roomId: string
  roomName: string
  userId: string
  onClose: () => void
}

const ICONS: Record<string, ElementType> = {
  projector: SlideshowIcon,
  laptop: LaptopIcon,
  vks: VideoCallIcon,
  flipchart: EditNoteIcon,
}

export function BookingDialog(props: Props) {
  // key пересоздаёт форму при каждом новом выделении слота
  return <BookingForm key={props.slot ? props.slot.start.getTime() : 'closed'} {...props} />
}

function BookingForm({ open, slot, roomId, roomName, userId, onClose }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const now = new Date()
  // Форма открывается по отпусканию кнопки мыши; следующий за ним click в части браузеров
  // (Firefox/Zen) попадает уже на затемнение и закрыл бы форму мгновенно — такие клики игнорируем
  const [openedAt] = useState(() => Date.now())

  const [values, setValues] = useState<FormValues>(() => rangeFromSlot(slot, new Date()))
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errors = validateForm(values, now)
  const valid = Object.keys(errors).length === 0
  const shown = (field: keyof FormValues) => (submitted || touched[field] ? errors[field] : undefined)
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }))

  // Занятость оборудования запрашиваем на выбранный интервал — как только он корректен
  const rangeOk = !errors.startDate && !errors.startTime && !errors.endDate && !errors.endTime
  const interval = rangeOk
    ? {
        from: parseLocal(values.startDate, values.startTime).toISOString(),
        to: parseLocal(values.endDate, values.endTime).toISOString(),
      }
    : skipToken
  const { data: resources = [] } = useGetResourcesQuery(interval === skipToken ? undefined : interval)
  const [createBooking, { isLoading }] = useCreateBookingMutation()

  const unavailable = (r: Resource) => r.status === 'IN_REPAIR' || r.busy === true
  const selected = resourceIds.filter((id) => {
    const r = resources.find((x) => x.id === id)
    return r && !unavailable(r)
  })

  const starts = startTimeOptions(values.startDate, now)
  const ends = endTimeOptions(values.startDate, values.startTime, values.endDate)

  const changeStart = (patch: { startDate?: string; startTime?: string }) => {
    setValues((v) => shiftRange(v, patch, now))
    setServerError(null)
  }

  const toggleResource = (id: string) =>
    setResourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = async () => {
    setSubmitted(true)
    setServerError(null)
    if (!valid) return
    try {
      await createBooking({
        roomId,
        userId,
        title: values.title.trim(),
        startTime: parseLocal(values.startDate, values.startTime).toISOString(),
        endTime: parseLocal(values.endDate, values.endTime).toISOString(),
        resourceIds: selected,
      }).unwrap()
      onClose()
    } catch (e) {
      setServerError(errorMessage(e))
    }
  }

  const minutes = rangeOk
    ? (parseLocal(values.endDate, values.endTime).getTime() - parseLocal(values.startDate, values.startTime).getTime()) / 60_000
    : 0
  const today = toDateStr(now)
  const yearAhead = toDateStr(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()))
  const lastEndDate = values.startDate
    ? toDateStr(new Date(parseLocal(values.startDate, '00:00').getTime() + RULES.maxMinutes * 60_000))
    : yearAhead

  const timeField = (props: {
    label: string
    field: 'startTime' | 'endTime'
    options: string[]
    onChange: (v: string) => void
  }) => (
    <TextField
      select
      label={props.label}
      value={props.options.includes(values[props.field]) ? values[props.field] : ''}
      onChange={(e) => {
        props.onChange(e.target.value)
        touch(props.field)
      }}
      error={Boolean(shown(props.field))}
      helperText={shown(props.field)}
      slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } } }}
      fullWidth
      required
    >
      {props.options.map((t) => (
        <MenuItem key={t} value={t}>{t}</MenuItem>
      ))}
    </TextField>
  )

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === 'backdropClick' && Date.now() - openedAt < 600) return
        onClose()
      }}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      transitionDuration={0}
      slotProps={{
        // Высота в vh, а не в % от контейнера: иначе при сбое вёрстки окно «схлопывается»
        paper: { sx: fullScreen ? undefined : { maxHeight: 'min(92vh, 920px)', minHeight: 'min(440px, 80vh)' } },
      }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        Новое бронирование
        <Typography variant="body2" color="text.secondary">
          {roomName}
        </Typography>
        <IconButton aria-label="Закрыть" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <TextField
            label="Тема встречи"
            value={values.title}
            autoFocus={!fullScreen}
            required
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            onBlur={() => values.title && touch('title')}
            error={Boolean(shown('title'))}
            helperText={shown('title') ?? `${values.title.length}/${RULES.titleMax}`}
            slotProps={{ htmlInput: { maxLength: RULES.titleMax }, formHelperText: { sx: { textAlign: shown('title') ? 'left' : 'right' } } }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Начало</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <DatePicker
                label="Дата"
                value={values.startDate ? dayjs(values.startDate) : null}
                minDate={dayjs(today)}
                maxDate={dayjs(yearAhead)}
                onChange={(v) => {
                  changeStart({ startDate: v?.isValid() ? v.format('YYYY-MM-DD') : '' })
                  touch('startDate')
                }}
                slotProps={{
                  textField: { required: true, fullWidth: true, error: Boolean(shown('startDate')), helperText: shown('startDate') },
                }}
              />
              {timeField({ label: 'Время', field: 'startTime', options: starts, onChange: (v) => changeStart({ startTime: v }) })}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Окончание</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <DatePicker
                label="Дата"
                value={values.endDate ? dayjs(values.endDate) : null}
                minDate={values.startDate ? dayjs(values.startDate) : dayjs(today)}
                maxDate={dayjs(lastEndDate)}
                onChange={(v) => {
                  setValues((s) => ({ ...s, endDate: v?.isValid() ? v.format('YYYY-MM-DD') : '' }))
                  touch('endDate')
                }}
                slotProps={{
                  textField: { required: true, fullWidth: true, error: Boolean(shown('endDate')), helperText: shown('endDate') },
                }}
              />
              {timeField({
                label: 'Время',
                field: 'endTime',
                options: ends,
                onChange: (v) => setValues((s) => ({ ...s, endTime: v })),
              })}
            </Stack>

            {starts.length === 0 && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                На сегодня свободного времени не осталось — выберите другую дату.
              </Alert>
            )}
            {rangeOk && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Длительность: {formatDuration(minutes)} · время в 24-часовом формате, бронь может переходить через полночь
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2">Оборудование</Typography>
            <Typography variant="caption" color="text.secondary">
              Необязательно — можно забронировать только комнату. Занятое на это время оборудование недоступно.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1, mt: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              {resources.map((r) => {
                const Icon = ICONS[r.type] ?? DevicesIcon
                const off = unavailable(r)
                const on = selected.includes(r.id)
                return (
                  <Box
                    key={r.id}
                    component="label"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: 0,
                      gap: 1,
                      px: 1,
                      py: 0.75,
                      border: 1,
                      borderRadius: '12px',
                      borderColor: on ? 'primary.main' : 'divider',
                      bgcolor: on ? 'rgba(79,70,229,.06)' : 'background.paper',
                      opacity: off ? 0.55 : 1,
                      cursor: off ? 'not-allowed' : 'pointer',
                      transition: 'border-color .15s, background-color .15s',
                    }}
                  >
                    <Checkbox size="small" checked={on} disabled={off} onChange={() => toggleResource(r.id)} sx={{ p: 0.5 }} />
                    <Icon fontSize="small" color={on ? 'primary' : 'action'} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {r.name}
                      </Typography>
                      <Typography variant="caption" color={off ? 'error' : 'text.secondary'}>
                        {r.status === 'IN_REPAIR' ? 'в ремонте' : r.busy ? 'занято на это время' : r.inventoryNumber}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>

          {serverError && <Alert severity="error">{serverError}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Отмена
        </Button>
        <Button variant="contained" onClick={submit} disabled={isLoading} size="large">
          Забронировать
        </Button>
      </DialogActions>
    </Dialog>
  )
}
