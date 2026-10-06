import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, createTestApp, DEMO_PASSWORD, loginAs } from './helpers.js';

describe('Аутентификация и ролевой доступ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `auth-e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('выдаёт JWT при верных email и пароле и не возвращает хеш пароля', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: DEMO_PASSWORD })
      .expect(201);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.user).toMatchObject({ email: 'employee@example.com', role: 'EMPLOYEE' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('отклоняет неверный пароль (401) и слишком короткий пароль (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: '123' })
      .expect(400);
  });

  it('закрывает защищённые эндпоинты без токена и с подделанным токеном (401)', async () => {
    await request(app.getHttpServer()).get('/api/rooms').expect(401);
    await request(app.getHttpServer()).get('/api/bookings').expect(401);
    await request(app.getHttpServer()).get('/api/rooms').set(bearer('not.a.token')).expect(401);
  });

  it('пропускает авторизованного сотрудника к справочникам', async () => {
    const { token } = await loginAs(app, 'employee');
    const rooms = await request(app.getHttpServer()).get('/api/rooms').set(bearer(token)).expect(200);
    expect(rooms.body.length).toBeGreaterThan(0);
  });

  it('регистрация сотрудников: сотруднику и офис-менеджеру — 403, администратору — 201', async () => {
    const body = { fullName: 'Тест Тестов', email, password: 'password123' };
    for (const who of ['employee', 'manager'] as const) {
      const { token } = await loginAs(app, who);
      await request(app.getHttpServer()).post('/api/auth/register').set(bearer(token)).send(body).expect(403);
    }
    const admin = await loginAs(app, 'admin');
    const created = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(bearer(admin.token))
      .send(body)
      .expect(201);
    expect(created.body.role).toBe('EMPLOYEE');
    expect(created.body.passwordHash).toBeUndefined();

    // тот же email повторно — конфликт
    await request(app.getHttpServer()).post('/api/auth/register').set(bearer(admin.token)).send(body).expect(409);
    // и созданный сотрудник может войти
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: body.password })
      .expect(201);
  });

  it('пароль в базе хранится в виде bcrypt-хеша, а не открытым текстом', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(user.passwordHash).not.toContain('password123');
  });

  it('создание переговорной: сотруднику — 403, офис-менеджеру — 201, дубликат названия — 409', async () => {
    const name = `auth-e2e-room-${Date.now()}`;
    const employee = await loginAs(app, 'employee');
    const manager = await loginAs(app, 'manager');
    await request(app.getHttpServer())
      .post('/api/rooms')
      .set(bearer(employee.token))
      .send({ name, floor: 1, capacity: 4 })
      .expect(403);
    const created = await request(app.getHttpServer())
      .post('/api/rooms')
      .set(bearer(manager.token))
      .send({ name, floor: 1, capacity: 4 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/rooms')
      .set(bearer(manager.token))
      .send({ name, floor: 1, capacity: 4 })
      .expect(409);
    await prisma.room.delete({ where: { id: created.body.id } });
  });
});
