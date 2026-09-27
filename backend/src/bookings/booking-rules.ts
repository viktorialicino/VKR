export const BOOKING_RULES = {
  titleMaxLength: 100,
  minMinutes: 15,
  maxMinutes: 7 * 24 * 60,
  slotMinutes: 15,
} as const;

// Возвращает текст ошибки или null, если интервал допустим.
// Бронь может начинаться и заканчиваться в разные дни (например, с 23:30 до 01:30).
export function validateBookingWindow(start: Date, end: Date, now = new Date()): string | null {
  const r = BOOKING_RULES;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Некорректная дата или время';
  if (end <= start) return 'Время окончания должно быть позже времени начала';

  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes < r.minMinutes) return `Минимальная длительность брони — ${r.minMinutes} минут`;
  if (minutes > r.maxMinutes) return `Максимальная длительность брони — ${r.maxMinutes / 60 / 24} суток`;

  // Допускаем начало в пределах текущего 15-минутного слота
  const slot = r.slotMinutes * 60_000;
  if (start.getTime() < Math.floor(now.getTime() / slot) * slot) return 'Нельзя бронировать на прошедшее время';
  return null;
}
