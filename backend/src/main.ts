import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const swagger = new DocumentBuilder()
    .setTitle('Бронирование переговорных комнат и учёт офисных ресурсов')
    .setVersion('0.1')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  app.getHttpAdapter().get('/', (_req, res) => res.redirect('/api/docs'));

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
