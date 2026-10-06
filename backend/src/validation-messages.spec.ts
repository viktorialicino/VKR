import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsEmail, IsInt, IsNotEmpty, IsString, Max, MinLength } from 'class-validator';
import { russianMessage, validationExceptionFactory } from './validation-messages.js';

class Sample {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsInt()
  @Max(50)
  quantity!: number;
}

describe('Сообщения проверки запросов на русском', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  });

  async function messagesFor(body: object): Promise<string[]> {
    try {
      await pipe.transform(body, { type: 'body', metatype: Sample });
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      return (e as BadRequestException).getResponse()['message' as never] as string[];
    }
    return [];
  }

  it('называет поле по-русски и объясняет, что исправить', async () => {
    const msgs = await messagesFor({ fullName: '', email: 'фыв', password: '123', quantity: 99 });
    expect(msgs).toContain('ФИО: поле обязательно для заполнения');
    expect(msgs).toContain('Email: введите адрес электронной почты в формате name@company.ru');
    expect(msgs).toContain('Пароль: слишком короткое значение, нужно не менее 8 символов');
    expect(msgs).toContain('Количество: значение не может быть больше 50');
  });

  it('сообщает о лишних полях', async () => {
    const msgs = await messagesFor({ fullName: 'А', email: 'a@b.ru', password: '12345678', quantity: 1, userId: 'x' });
    expect(msgs).toEqual(['userId: это поле не поддерживается']);
  });

  it('для неизвестного ограничения даёт общее сообщение', () => {
    expect(russianMessage('somethingNew', 'x', 'Поле')).toBe('Поле: некорректное значение');
  });
});
