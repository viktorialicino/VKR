// Проверка полей форм: сообщения на русском с подсказкой, что именно исправить.
// Браузерные подсказки («Please enter an email address») отключены атрибутом noValidate.
export type Errors<T extends string> = Partial<Record<T, string>>

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const required = (value: string, hint: string) => (value.trim() === '' ? hint : undefined)

export function email(value: string): string | undefined {
  if (value.trim() === '') return 'Введите адрес электронной почты'
  if (!EMAIL_PATTERN.test(value.trim())) return 'Адрес указан неверно. Пример: ivanov@company.ru'
  return undefined
}

export function password(value: string, min = 8): string | undefined {
  if (value === '') return 'Придумайте пароль'
  if (value.length < min) return `Пароль слишком короткий: сейчас ${value.length}, нужно не менее ${min} символов`
  return undefined
}

export function integerInRange(raw: string, min: number, max: number, what: string): string | undefined {
  if (raw.trim() === '') return `Укажите ${what}`
  const n = Number(raw)
  if (!Number.isInteger(n)) return `${what[0].toUpperCase()}${what.slice(1)} должно быть целым числом`
  if (n < min || n > max) return `Допустимо от ${min} до ${max}`
  return undefined
}

export const hasErrors = (errors: object) => Object.values(errors).some(Boolean)
