import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, createTestApp, loginAs } from './helpers.js';

describe('Изменение бронирования (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employee: { token: string; id: string };
  let manager: { token: string; id: string };
  let roomId: string;
  let projectorId: string;
  let brokenId: string;
  const tag = `edit-e2e-${Date.now()}`;
  const ymd = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
  const at = (h: number, m = 0) =>
    new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`).toISOString();

  const create = (over: Record<string, unknown> = {}, token = employee.token) =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .set(bearer(token))
      .send({ roomId, title: tag, startTime: at(9), endTime: at(10), ...over });
  const patch = (id: string, body: Record<string, unknown>, token = employee.token) =>
    request(app.getHttpServer()).patch(`/api/bookings/${id}`).set(bearer(token)).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    employee = await loginAs(app, 'employee');
    manager = await loginAs(app, 'manager');
    roomId = (await prisma.room.create({ data: { name: `${tag}-room`, floor: 1, capacity: 4 } })).id;
    projectorId = (await prisma.resource.create({ data: { name: `${tag} проектор`, type: 'projector', inventoryNumber: `${tag}-p` } })).id;
    brokenId = (
      await prisma.resource.create({
        data: { name: `${tag} ноутбук`, type: 'laptop', inventoryNumber: `${tag}-l`, status: 'IN_REPAIR' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.bookingResource.deleteMany({ where: { resourceId: { in: [projectorId, brokenId] } } });
    await prisma.booking.deleteMany({ where: { roomId } });
    await prisma.resource.deleteMany({ where: { id: { in: [projectorId, brokenId] } } });
    await prisma.room.delete({ where: { id: roomId } });
    await app.close();
  });

  it('меняет тему и время своей брони', async () => {
    const b = (await create().expect(201)).body;
    const res = await patch(b.id, { title: 'Новая тема', startTime: at(9, 30), endTime: at(10, 30) }).expect(200);
    expect(res.body.title).toBe('Новая тема');
    expect(res.body.startTime).toBe(at(9, 30));
    expect(res.body.userId).toBe(employee.id);
  });

  it('позволяет продлить бронь внутрь её же интервала: сама с собой бронь не конфликтует', async () => {
    const b = (await create({ startTime: at(11), endTime: at(12) }).expect(201)).body;
    const res = await patch(b.id, { endTime: at(12, 30) }).expect(200);
    expect(res.body.endTime).toBe(at(12, 30));
  });

  it('отказывает (409), если новое время пересекается с другой бронью, и называет её интервал', async () => {
    const other = (await create({ startTime: at(14), endTime: at(15) }).expect(201)).body;
    const mine = (await create({ startTime: at(13), endTime: at(13, 45) }).expect(201)).body;
    const res = await patch(mine.id, { endTime: at(14, 30) }).expect(409);
    expect(res.body.conflict.startTime).toBe(other.startTime);
    // после отказа бронь осталась прежней
    const list = await request(app.getHttpServer())
      .get('/api/bookings')
      .set(bearer(employee.token))
      .query({ roomId, from: at(13), to: at(13, 50) })
      .expect(200);
    expect(list.body.find((x: { id: string }) => x.id === mine.id).endTime).toBe(at(13, 45));
  });

  it('заменяет набор оборудования: добавляет, а затем снимает ресурс', async () => {
    const b = (await create({ startTime: at(16), endTime: at(17) }).expect(201)).body;
    const added = await patch(b.id, { resourceIds: [projectorId] }).expect(200);
    expect(added.body.resources).toHaveLength(1);
    const removed = await patch(b.id, { resourceIds: [] }).expect(200);
    expect(removed.body.resources).toHaveLength(0);
  });

  it('не даёт занять время и ресурс другой брони (409) и взять ресурс в ремонте (409)', async () => {
    await create({ startTime: at(18), endTime: at(19), resourceIds: [projectorId] }).expect(201);
    const mine = (await create({ startTime: at(18, 30), endTime: at(19, 30) }).expect(409)).body;
    expect(mine.conflict).toBeTruthy();
    const free = (await create({ startTime: at(20), endTime: at(21) }).expect(201)).body;
    await patch(free.id, { startTime: at(18, 30), endTime: at(19, 30), resourceIds: [projectorId] }).expect(409);
    await patch(free.id, { resourceIds: [brokenId] }).expect(409);
  });

  it('при смене времени переносит и назначенные ресурсы (ресурс остаётся за бронью)', async () => {
    const b = (await create({ startTime: at(22), endTime: at(23), resourceIds: [projectorId] }).expect(201)).body;
    await patch(b.id, { startTime: at(22, 15), endTime: at(23, 15) }).expect(200);
    const row = await prisma.bookingResource.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(row.startTime.toISOString()).toBe(at(22, 15));
    expect(row.active).toBe(true);
  });

  it('показывает ресурс свободным для самой брони при запросе с excludeBookingId', async () => {
    const b = (await create({ startTime: at(5), endTime: at(6), resourceIds: [projectorId] }).expect(201)).body;
    const query = { from: at(5), to: at(6) };
    const busy = await request(app.getHttpServer()).get('/api/resources').set(bearer(employee.token)).query(query).expect(200);
    expect(busy.body.find((r: { id: string }) => r.id === projectorId).busy).toBe(true);
    const own = await request(app.getHttpServer())
      .get('/api/resources')
      .set(bearer(employee.token))
      .query({ ...query, excludeBookingId: b.id })
      .expect(200);
    expect(own.body.find((r: { id: string }) => r.id === projectorId).busy).toBe(false);
  });

  it('права: сотрудник не меняет чужую бронь (403), офис-менеджер – меняет', async () => {
    const b = (await create({ startTime: at(3), endTime: at(4) }).expect(201)).body;
    await patch(b.id, { title: 'Чужая' }, manager.token).expect(200);
    const foreign = (await create({ startTime: at(2), endTime: at(3) }, manager.token).expect(201)).body;
    await patch(foreign.id, { title: 'Взлом' }, employee.token).expect(403);
  });

  it('отклоняет изменение отменённой брони, неверный интервал, лишние поля и несуществующую бронь', async () => {
    const b = (await create({ startTime: at(7), endTime: at(8) }).expect(201)).body;
    await patch(b.id, { endTime: at(6) }).expect(400);
    await patch(b.id, { roomId: '00000000-0000-4000-8000-000000000000' }).expect(400);
    await patch(b.id, { title: 'я'.repeat(101) }).expect(400);
    await request(app.getHttpServer()).delete(`/api/bookings/${b.id}`).set(bearer(employee.token)).expect(200);
    await patch(b.id, { title: 'После отмены' }).expect(400);
    await patch('00000000-0000-4000-8000-000000000000', { title: 'x' }).expect(404);
  });
});
