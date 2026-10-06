import { INestApplication, ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from './validation-messages.js';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}
