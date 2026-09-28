import type { DatesSetArg, EventContentArg } from '@fullcalendar/core'
import ruLocale from '@fullcalendar/core/locales/ru'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import multiMonthPlugin from '@fullcalendar/multimonth'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import AddIcon from '@mui/icons-material/Add'
import { Alert, Box, Chip, Fab, Snackbar, Stack, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
import { skipToken, useGetBookingsQuery } from '../../shared/api/api'
import type { Booking } from '../../shared/api/types'
import { BookingDetailsDialog } from './BookingDetailsDialog'
import { BookingDialog, type Slot } from './BookingDialog'
import { CalendarToolbar, type ViewId } from './CalendarToolbar'
import { defaultSlot, floorToStep, slotForDay, toDateStr } from './bookingRules'

interface Props {
  roomId: string
  roomName: string
  userId: string
}

const OWN = '#4f46e5'
const OTHER = '#94a3b8'
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const

export function BookingCalendar({ roomId, roomName, userId }: Props) {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isSm = useMediaQuery(theme.breakpoints.up('sm'))
  const isMd = useMediaQuery(theme.breakpoints.up('md'))
  const isLg = useMediaQuery(theme.breakpoints.up('lg'))

  const calRef = useRef<FullCalendar>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState('')
  const [view, setView] = useState<string>(isXs ? 'timeGridDay' : 'timeGridWeek')
  const [current, setCurrent] = useState(() => new Date())
  const [slot, setSlot] = useState<Slot | null>(null)
  const [details, setDetails] = useState<Booking | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // «Сейчас» обновляется раз в минуту, чтобы затенение прошедшего времени двигалось само
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: bookings = [], isFetching } = useGetBookingsQuery(range ? { roomId, ...range } : skipToken)

  const api = () => calRef.current?.getApi()
  const isTimeGrid = view.startsWith('timeGrid')

  // На телефоне неделя из семи колонок нечитаема — заменяем её на «3 дня» и обратно
  useEffect(() => {
    const a = api()
    if (!a) return
    if (isXs && a.view.type === 'timeGridWeek') a.changeView('timeGridThreeDay')
    if (!isXs && a.view.type === 'timeGridThreeDay') a.changeView('timeGridWeek')
  }, [isXs])

  // Прошедшее время в сетках «день/неделя» затеняем фоновым событием: от начала периода до «сейчас»
  const pastShade =
    range && isTimeGrid && new Date(range.from).getTime() < now
      ? [{ start: range.from, end: new Date(now).toISOString(), display: 'background' as const, classNames: ['ob-past'] }]
      : []

  const events = bookings.map((b) => ({
    id: b.id,
    title: b.title,
    start: b.startTime,
    end: b.endTime,
    classNames: [b.userId === userId ? 'ob-own' : 'ob-other'],
    borderColor: b.userId === userId ? OWN : OTHER,
    extendedProps: { booking: b },
  }))

  // В годовом виде вместо событий отмечаем точкой дни, где есть брони
  const busyDays = new Set(
    bookings.flatMap((b) => {
      const days: string[] = []
      const end = new Date(b.endTime)
      for (let d = new Date(b.startTime); d < end && days.length < 9; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        days.push(toDateStr(d))
      }
      return days
    }),
  )

  const dayClasses = (a: { date: Date; isPast: boolean; isToday: boolean; view: { type: string } }) => {
    const type = a.view.type
    const classes: string[] = []
    if (!type.startsWith('timeGrid') && a.isPast && !a.isToday) classes.push('ob-past')
    if (type === 'multiMonthYear' && busyDays.has(toDateStr(a.date))) classes.push('ob-busy-day')
    return classes
  }

  const onDatesSet = (arg: DatesSetArg) => {
    setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })
    setTitle(arg.view.title)
    setView(arg.view.type)
    setCurrent(arg.view.calendar.getDate())
  }

  const renderEvent = (arg: EventContentArg) => {
    const b = arg.event.extendedProps.booking as Booking | undefined
    if (!b) return true // фоновое затенение прошлого — стандартная отрисовка
    const type = arg.view.type
    if (type.startsWith('timeGrid')) {
      return (
        <div className="ob-ev">
          <b>{arg.timeText}</b>
          <span>{b.title}</span>
          <span className="ob-ev-user">{b.user.fullName}</span>
        </div>
      )
    }
    if (type === 'dayGridMonth') {
      return (
        <div className="ob-ev-line">
          <b>{arg.timeText}</b> {b.title}
        </div>
      )
    }
    return true
  }

  // Как в Google Calendar: клик по ячейке дня в месяце открывает форму брони на этот день,
  // а клик по числу дня (navLinks) — расписание дня. В годовом виде ячейки мелкие,
  // поэтому клик открывает день.
  const onDateClick = (arg: DateClickArg) => {
    if (arg.view.type === 'dayGridMonth') {
      if (toDateStr(arg.date) < toDateStr(new Date())) {
        setNotice('На прошедшую дату бронировать нельзя')
        return
      }
      openSlot(slotForDay(arg.date))
    } else if (arg.view.type === 'multiMonthYear') {
      arg.view.calendar.changeView('timeGridDay', arg.date)
    } else if (arg.view.type.startsWith('timeGrid')) {
      // Одиночный клик по сетке идёт тем же путём, что и клик по дню в месяце (он работает
      // везде); выделение протяжкой обрабатывает select
      if (arg.date.getTime() < floorToStep(new Date()).getTime()) {
        setNotice('Нельзя бронировать на прошедшее время')
        return
      }
      openSlot({ start: arg.date, end: new Date(arg.date.getTime() + 60 * 60_000) })
    }
  }

  // Протяжка мышью — бронь ровно на выделенный интервал. Одиночный клик (выделение из одного
  // шага сетки) сюда не попадает: его обрабатывает onDateClick, бронь на час, как в Google Calendar
  const onSelect = (arg: { start: Date; end: Date }) => {
    if (arg.end.getTime() - arg.start.getTime() <= 30 * 60_000) return
    openSlot({ start: arg.start, end: arg.end })
  }

  // Форму открываем на следующем такте: не внутри обработчика указателя FullCalendar,
  // иначе фокус и вёрстка окна конфликтуют с ещё не завершённым жестом выделения
  const openSlot = (next: Slot) => {
    setTimeout(() => setSlot(next), 0)
  }
  const startNew = () => setSlot(defaultSlot(api()?.getDate() ?? new Date()))
  const closeNew = () => {
    setSlot(null)
    api()?.unselect()
  }

  return (
    <>
      <CalendarToolbar
        title={title}
        view={view}
        compact={isXs}
        current={current}
        loading={isFetching}
        onView={(v: ViewId) => api()?.changeView(v)}
        onPrev={() => api()?.prev()}
        onNext={() => api()?.next()}
        onToday={() => api()?.today()}
        onJump={(d) => api()?.gotoDate(d)}
        onNew={startNew}
      />

      <Stack direction="row" spacing={1} sx={{ px: { xs: 1.5, sm: 2 }, pb: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
        <Chip size="small" label="Моя бронь" avatar={<Dot color={OWN} />} variant="outlined" />
        <Chip size="small" label="Занято другими" avatar={<Dot color={OTHER} />} variant="outlined" />
      </Stack>

      <Box sx={{ px: { xs: 0.5, sm: 2 }, pb: { xs: 1, sm: 2 } }}>
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, multiMonthPlugin, interactionPlugin]}
          initialView={isXs ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={false}
          locale={ruLocale}
          firstDay={1}
          height={isTimeGrid ? (isXs ? '72vh' : 'clamp(520px, calc(100vh - 330px), 900px)') : 'auto'}
          scrollTime="07:00:00"
          allDaySlot={false}
          nowIndicator
          navLinks
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          slotLabelInterval="01:00"
          slotLabelFormat={TIME_FORMAT}
          eventTimeFormat={TIME_FORMAT}
          selectable={isTimeGrid}
          selectMirror
          longPressDelay={250}
          selectLongPressDelay={250}
          selectAllow={(info) => info.start.getTime() >= floorToStep(new Date()).getTime()}
          dayCellClassNames={dayClasses}
          events={[...pastShade, ...events]}
          eventContent={renderEvent}
          eventDisplay={view === 'multiMonthYear' ? 'none' : 'block'}
          dayMaxEvents={3}
          moreLinkClick="day"
          multiMonthMaxColumns={isLg ? 4 : isMd ? 3 : isSm ? 2 : 1}
          multiMonthMinWidth={260}
          views={{
            timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 }, dayHeaderFormat: { weekday: 'short', day: 'numeric' }, titleFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
            timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' }, titleFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
            timeGridDay: { dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' } },
            dayGridMonth: { dayHeaderFormat: { weekday: 'short' } },
            multiMonthYear: { dayHeaderFormat: { weekday: 'narrow' } },
          }}
          datesSet={onDatesSet}
          select={onSelect}
          dateClick={onDateClick}
          eventClick={(arg) => {
            // у фонового затенения прошлого брони нет — открывать нечего
            const booking = arg.event.extendedProps.booking as Booking | undefined
            if (booking) setDetails(booking)
          }}
        />
      </Box>

      <Fab
        variant="extended"
        color="primary"
        aria-label="Новая бронь"
        onClick={startNew}
        sx={{ position: 'fixed', right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))', display: { xs: 'inline-flex', sm: 'none' }, zIndex: 5 }}
      >
        <AddIcon sx={{ mr: 0.5 }} />
        Бронь
      </Fab>

      <BookingDialog open={slot !== null} slot={slot} roomId={roomId} roomName={roomName} onClose={closeNew} />
      <BookingDetailsDialog booking={details} own={details?.userId === userId} onClose={() => setDetails(null)} />

      <Snackbar open={notice !== null} autoHideDuration={3000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </>
  )
}

function Dot({ color }: { color: string }) {
  return <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${color} !important`, ml: '8px !important', mr: '-2px !important' }} />
}
