// Правила зеркалят backend (backend/src/bookings/booking-rules.ts): сервер проверяет их
// повторно, здесь они нужны, чтобы показать ошибку до отправки формы.
// Бронь может начинаться и заканчиваться в разные дни (например, 23:30 → 01:30).
export const RULES = {
  titleMax: 100,
  step: 15,
  minMinutes: 15,
  maxMinutes: 7 * 24 * 60,
} as const

const pad = (n: number) => String(n).padStart(2, '0')

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

// 00:00, 00:15, … 23:45 — всегда 24-часовой формат, независимо от настроек ОС
export const TIME_OPTIONS = Array.from({ length: (24 * 60) / RULES.step }, (_, i) => fromMinutes(i * RULES.step))

export const floorToStep = (d: Date) => {
  const x = new Date(d)
  x.setSeconds(0, 0)
  x.setMinutes(Math.floor(x.getMinutes() / RULES.step) * RULES.step)
  return x
}

export const parseLocal = (date: string, time: string) => new Date(`${date}T${time}:00`)
const ms = (date: string, time: string) => (date && time ? parseLocal(date, time).getTime() : NaN)
const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000)

export function formatDuration(minutes: number) {
  const days = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  return [days ? `${days} д` : '', h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ')
}

export interface FormValues {
  title: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

export type FieldErrors = Partial<Record<keyof FormValues, string>>

export function validateForm(v: FormValues, now: Date): FieldErrors {
  const errors: FieldErrors = {}
  const today = toDateStr(now)
  const start = ms(v.startDate, v.startTime)
  const end = ms(v.endDate, v.endTime)

  if (!v.title.trim()) errors.title = 'Укажите тему встречи'
  else if (v.title.trim().length > RULES.titleMax) errors.title = `Не длиннее ${RULES.titleMax} символов`

  if (!v.startDate) errors.startDate = 'Выберите дату начала'
  else if (v.startDate < today) errors.startDate = 'Нельзя бронировать на прошедшую дату'

  if (!v.startTime) errors.startTime = 'Выберите время начала'
  else if (!errors.startDate && start < floorToStep(now).getTime()) errors.startTime = 'Это время уже прошло'

  if (!v.endDate) errors.endDate = 'Выберите дату окончания'
  else if (v.startDate && v.endDate < v.startDate) errors.endDate = 'Дата окончания раньше даты начала'

  if (!v.endTime) errors.endTime = 'Выберите время окончания'
  else if (!errors.endDate && !Number.isNaN(start) && !Number.isNaN(end)) {
    const minutes = (end - start) / 60_000
    if (minutes <= 0) errors.endTime = 'Окончание должно быть позже начала'
    else if (minutes < RULES.minMinutes) errors.endTime = `Не короче ${RULES.minMinutes} минут`
    else if (minutes > RULES.maxMinutes) errors.endTime = `Не длиннее ${RULES.maxMinutes / 1440} суток`
  }
  return errors
}

// Варианты времени начала: на сегодня — только не раньше текущего 15-минутного слота
export const startTimeOptions = (date: string, now: Date) => {
  if (date !== toDateStr(now)) return TIME_OPTIONS
  const earliest = toMinutes(toTimeStr(floorToStep(now)))
  return TIME_OPTIONS.filter((t) => toMinutes(t) >= earliest)
}

// Варианты времени окончания: в тот же день — только позже начала
export const endTimeOptions = (startDate: string, startTime: string, endDate: string) =>
  endDate === startDate && startTime
    ? TIME_OPTIONS.filter((t) => toMinutes(t) - toMinutes(startTime) >= RULES.minMinutes)
    : TIME_OPTIONS

// Меняет дату/время начала и сдвигает окончание, сохраняя длительность (как в Google Calendar)
export function shiftRange(
  v: FormValues,
  patch: Partial<Pick<FormValues, 'startDate' | 'startTime'>>,
  now: Date,
): FormValues {
  const next = { ...v, ...patch }
  const previous = (ms(v.endDate, v.endTime) - ms(v.startDate, v.startTime)) / 60_000
  const duration = previous >= RULES.minMinutes && previous <= RULES.maxMinutes ? previous : 60

  let start = parseLocal(next.startDate, next.startTime)
  const earliest = floorToStep(now)
  if (next.startDate === toDateStr(now) && start < earliest) start = earliest

  const end = addMinutes(start, duration)
  return { ...next, startDate: toDateStr(start), startTime: toTimeStr(start), endDate: toDateStr(end), endTime: toTimeStr(end) }
}

export function rangeFromSlot(slot: { start: Date; end: Date } | null, now: Date) {
  const start = floorToStep(slot?.start ?? now)
  const wanted = slot?.end ?? addMinutes(start, 60)
  const end = wanted.getTime() - start.getTime() >= RULES.minMinutes * 60_000 ? wanted : addMinutes(start, 60)
  return shiftRange(
    { title: '', startDate: toDateStr(start), startTime: toTimeStr(start), endDate: toDateStr(end), endTime: toTimeStr(end) },
    {},
    now,
  )
}

// Слот для клика по дню в месяце: выбранная дата, по умолчанию 10:00–11:00
// (для сегодняшнего дня — ближайший целый час), время потом уточняют в форме
export function slotForDay(day: Date, now = new Date()) {
  const start = new Date(day)
  start.setHours(10, 0, 0, 0)
  if (toDateStr(day) === toDateStr(now)) {
    const next = new Date(now)
    next.setMinutes(now.getMinutes() > 0 ? 60 : 0, 0, 0)
    start.setTime(next.getTime())
  }
  return { start, end: addMinutes(start, 60) }
}

// Кнопка «Новая бронь»: ближайший целый час
export function defaultSlot(day: Date, now = new Date()) {
  return slotForDay(toDateStr(day) === toDateStr(now) ? now : day, now)
}
