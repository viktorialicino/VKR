import { validateBookingWindow } from './booking-rules.js';

const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+03:00`);
const NOW = at('2030-01-10', '09:07');

describe('validateBookingWindow', () => {
  it('принимает обычную встречу', () => {
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-11', '11:00'), NOW)).toBeNull();
  });

  it('принимает бронь через полночь: с 23:30 до 01:30 следующего дня', () => {
    expect(validateBookingWindow(at('2030-01-20', '23:30'), at('2030-01-21', '01:30'), NOW)).toBeNull();
  });

  it('принимает многодневную бронь и граничные значения: 15 минут и ровно 7 суток', () => {
    expect(validateBookingWindow(at('2030-01-11', '09:00'), at('2030-01-13', '18:00'), NOW)).toBeNull();
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-11', '10:15'), NOW)).toBeNull();
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-18', '10:00'), NOW)).toBeNull();
  });

  it('отклоняет конец раньше начала, в том числе по дате (начало 14-го, конец 13-го)', () => {
    expect(validateBookingWindow(at('2030-01-11', '11:00'), at('2030-01-11', '10:00'), NOW)).toMatch(/позже/);
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-11', '10:00'), NOW)).toMatch(/позже/);
    expect(validateBookingWindow(at('2030-01-14', '10:00'), at('2030-01-13', '11:00'), NOW)).toMatch(/позже/);
  });

  it('отклоняет слишком короткие и слишком длинные брони', () => {
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-11', '10:10'), NOW)).toMatch(/Минимальная/);
    expect(validateBookingWindow(at('2030-01-11', '10:00'), at('2030-01-18', '10:15'), NOW)).toMatch(/Максимальная/);
  });

  it('отклоняет прошедшее время, но допускает текущий 15-минутный слот', () => {
    expect(validateBookingWindow(at('2030-01-10', '08:30'), at('2030-01-10', '09:30'), NOW)).toMatch(/прошедшее/);
    expect(validateBookingWindow(at('2030-01-10', '09:00'), at('2030-01-10', '10:00'), NOW)).toBeNull();
  });
});
