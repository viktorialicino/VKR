import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, createTestApp, loginAs } from './helpers.js';

describe('Бронирование (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employee: { token: string; id: string };
  let manager: { token: string; id: string };
  let roomId: string;
  let otherRoomId: string;
  let resourceId: string;

  const tag = `e2e-${Date.now()}`;
  // Интервалы задаём в поясе Москвы (UTC+3), на два месяца вперёд — чтобы не упереться в «прошедшее время»
  const ymd = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const at = (h: number, m = 0) =>
    new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`).toISOString();

  const book = (over: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .set(bearer(employee.token))
      .send({ roomId, title: tag, ...over });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    employee = await loginAs(app, 'employee');
    manager = await loginAs(app, 'manager');
    roomId = (await prisma.room.create({ data: { name: `${tag}-a`, floor: 1, capacity: 4 } })).id;
    otherRoomId = (await prisma.room.create({ data: { name: `${tag}-b`, floor: 1, capacity: 4 } })).id;
    resourceId = (
      await prisma.resource.create({ data: { name: `${tag} проектор`, type: 'projector', inventoryNumber: tag } })
    ).id;
  });

  afterAll(async () => {
    await prisma.bookingResource.deleteMany({ where: { resourceId } });
    await prisma.booking.deleteMany({ where: { roomId: { in: [roomId, otherRoomId] } } });
    await prisma.resource.delete({ where: { id: resourceId } });
    await prisma.room.deleteMany({ where: { id: { in: [roomId, otherRoomId] } } });
    await app.close();
  });

  it('создаёт бронь на свободный слот вместе с ресурсом', async () => {
    const res = await book({ startTime: at(10), endTime: at(11), resourceIds: [resourceId] }).expect(201);
    expect(res.body.resources).toHaveLength(1);
  });

  it('отклоняет пересекающуюся бронь той же комнаты (409) и называет конфликтующий интервал', async () => {
    const res = await book({ startTime: at(10, 30), endTime: at(11, 30) }).expect(409);
    expect(res.body.conflict.startTime).toBe(at(10));
  });

  it('принимает бронь «встык» — граница интервала не считается пересечением', async () => {
    await book({ startTime: at(11), endTime: at(12) }).expect(201);
  });

  it('не отдаёт один и тот же ресурс двум пересекающимся броням в разных комнатах', async () => {
    await book({ roomId: otherRoomId, startTime: at(10, 15), endTime: at(10, 45), resourceIds: [resourceId] }).expect(409);
  });

  it('отклоняет интервал, где конец раньше начала (400)', async () => {
    await book({ startTime: at(15), endTime: at(14) }).expect(400);
  });

  it('после отмены брони слот и ресурс снова свободны', async () => {
    const created = await book({ startTime: at(13), endTime: at(14), resourceIds: [resourceId] }).expect(201);
    await request(app.getHttpServer())
      .delete(`/api/bookings/${created.body.id}`)
      .set(bearer(employee.token))
      .expect(200);
    await book({ roomId: otherRoomId, startTime: at(13), endTime: at(14), resourceIds: [resourceId] }).expect(201);
  });

  it('отклоняет слишком длинную тему (400)', async () => {
    await book({ title: 'я'.repeat(101), startTime: at(15), endTime: at(16) }).expect(400);
  });

  it('принимает бронь через полночь и не даёт занять её вторую половину (23:00 → 01:00)', async () => {
    const nextDay = new Date(Date.parse(`${ymd}T00:00:00+03:00`) + 86_400_000).toISOString();
    await book({ startTime: at(23), endTime: new Date(Date.parse(nextDay) + 3_600_000).toISOString() }).expect(201);
    const clash = await book({
      startTime: new Date(Date.parse(nextDay) + 1_800_000).toISOString(),
      endTime: new Date(Date.parse(nextDay) + 5_400_000).toISOString(),
    }).expect(409);
    expect(clash.body.conflict).toBeTruthy();
  });

  it('отклоняет слишком короткие (<15 мин) и слишком длинные (>7 суток) брони (400)', async () => {
    await book({ startTime: at(15), endTime: at(15, 10) }).expect(400);
    await book({
      startTime: at(9),
      endTime: new Date(Date.parse(at(9)) + 8 * 86_400_000).toISOString(),
    }).expect(400);
  });

  it('показывает занятость оборудования на интервале и не даёт взять ресурс в ремонте', async () => {
    const busy = await request(app.getHttpServer())
      .get('/api/resources')
      .set(bearer(employee.token))
      .query({ from: at(10), to: at(11) })
      .expect(200);
    expect(busy.body.find((r: { id: string }) => r.id === resourceId).busy).toBe(true);

    const free = await request(app.getHttpServer())
      .get('/api/resources')
      .set(bearer(employee.token))
      .query({ from: at(16), to: at(17) })
      .expect(200);
    expect(free.body.find((r: { id: string }) => r.id === resourceId).busy).toBe(false);

    await prisma.resource.update({ where: { id: resourceId }, data: { status: 'IN_REPAIR' } });
    await book({ startTime: at(16), endTime: at(17), resourceIds: [resourceId] }).expect(409);
    await prisma.resource.update({ where: { id: resourceId }, data: { status: 'AVAILABLE' } });
  });

  it('записывает автора брони из токена, а не из тела запроса', async () => {
    const res = await book({ startTime: at(20), endTime: at(21), userId: manager.id });
    // userId в теле запроса запрещён валидацией (whitelist + forbidNonWhitelisted)
    expect(res.status).toBe(400);
    const ok = await book({ startTime: at(20), endTime: at(21) }).expect(201);
    expect(ok.body.userId).toBe(employee.id);
  });

  it('не даёт сотруднику отменить чужую бронь (403), но офис-менеджеру — даёт', async () => {
    const created = await book({ startTime: at(21, 30), endTime: at(22) }).expect(201);
    const other = await loginAs(app, 'admin');
    await request(app.getHttpServer())
      .delete(`/api/bookings/${created.body.id}`)
      .set(bearer(other.token))
      .expect(200);

    const own = await book({ startTime: at(21, 30), endTime: at(22) }).expect(201);
    const foreignEmployee = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(bearer(other.token))
      .send({ fullName: 'Тест Сотрудник', email: `${tag}@example.com`, password: 'password123' })
      .expect(201);
    const foreign = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `${tag}@example.com`, password: 'password123' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/bookings/${own.body.id}`)
      .set(bearer(foreign.body.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/bookings/${own.body.id}`)
      .set(bearer(manager.token))
      .expect(200);
    await prisma.user.delete({ where: { id: foreignEmployee.body.id } });
  });

  it('при 10 одновременных запросах на один слот создаётся ровно одна бронь', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => book({ startTime: at(18), endTime: at(19) })),
    );
    const codes = results.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
  });
});
