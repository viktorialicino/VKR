import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

// Названия полей запросов, как их видит пользователь в интерфейсе
const FIELD_LABELS: Record<string, string> = {
  fullName: 'ФИО',
  email: 'Email',
  password: 'Пароль',
  role: 'Роль',
  department: 'Подразделение',
  name: 'Название',
  type: 'Тип',
  inventoryNumber: 'Инвентарный номер',
  quantity: 'Количество',
  roomId: 'Комната',
  holderId: 'Сотрудник',
  action: 'Действие',
  title: 'Тема встречи',
  startTime: 'Время начала',
  endTime: 'Время окончания',
  resourceIds: 'Оборудование',
  floor: 'Этаж',
  capacity: 'Вместимость',
  from: 'Начало интервала',
  to: 'Конец интервала',
  status: 'Статус',
};

/** Переводит сообщение class-validator на русский; число из исходного текста (границы) подставляется в ответ. */
export function russianMessage(constraint: string, original: string, label: string): string {
  const num = original.match(/(\d+)(?!.*\d)/)?.[1];
  switch (constraint) {
    case 'isNotEmpty':
      return `${label}: поле обязательно для заполнения`;
    case 'isString':
      return `${label}: ожидается текст`;
    case 'isEmail':
      return `${label}: введите адрес электронной почты в формате name@company.ru`;
    case 'minLength':
      return `${label}: слишком короткое значение, нужно не менее ${num} символов`;
    case 'maxLength':
      return `${label}: слишком длинное значение, допускается не более ${num} символов`;
    case 'isInt':
      return `${label}: введите целое число`;
    case 'min':
      return `${label}: значение не может быть меньше ${num}`;
    case 'max':
      return `${label}: значение не может быть больше ${num}`;
    case 'isUuid':
      return `${label}: выберите значение из списка`;
    case 'isEnum':
    case 'isIn':
      return `${label}: выбрано недопустимое значение`;
    case 'isDate':
    case 'isDateString':
    case 'isISO8601':
      return `${label}: укажите корректную дату и время`;
    case 'isArray':
      return `${label}: ожидается список`;
    case 'whitelistValidation':
      return `${label}: это поле не поддерживается`;
    default:
      return `${label}: некорректное значение`;
  }
}

function collect(errors: ValidationError[], out: string[], path = '') {
  for (const e of errors) {
    const label = FIELD_LABELS[e.property] ?? e.property;
    for (const [constraint, original] of Object.entries(e.constraints ?? {})) {
      out.push(russianMessage(constraint, original, path ? `${path} / ${label}` : label));
    }
    if (e.children?.length) collect(e.children, out, label);
  }
}

/** Для ValidationPipe: собирает все ошибки проверки запроса в список русских сообщений. */
export function validationExceptionFactory(errors: ValidationError[]) {
  const messages: string[] = [];
  collect(errors, messages);
  return new BadRequestException(messages);
}
