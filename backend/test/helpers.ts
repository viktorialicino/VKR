import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Демо-пароль задаётся сидированием (prisma/seed.ts)
export const DEMO_PASSWORD = 'password123';

export type DemoRole = 'employee' | 'manager' | 'admin';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

// Возвращает JWT сидированного пользователя: employee / manager / admin
export async function loginAs(app: INestApplication, who: DemoRole): Promise<{ token: string; id: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: `${who}@example.com`, password: DEMO_PASSWORD })
    .expect(201);
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
