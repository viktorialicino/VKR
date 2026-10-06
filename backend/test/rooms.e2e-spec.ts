import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, createTestApp, loginAs } from './helpers.js';

describe('Переговорные комнаты (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employee: { token: string; id: string };
  let roomId: string;
  const name = `rooms-e2e-${Date.now()}`;
  const day = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const at = (h: number) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00+03:00`).toISOString();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    employee = await loginAs(app, 'employee');
    roomId = (await prisma.room.create({ data: { name, floor: 9, capacity: 40 } })).id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { roomId } });
    await prisma.room.delete({ where: { id: roomId } });
    await app.close();
  });

  it('фильтрует комнаты по минимальной вместимости', async () => {
    const big = await request(app.getHttpServer())
      .get('/api/rooms')
      .set(bearer(employee.token))
      .query({ minCapacity: 40 })
      .expect(200);
    expect(big.body.some((r: { id: string }) => r.id === roomId)).toBe(true);
    expect(big.body.every((r: { capacity: number }) => r.capacity >= 40)).toBe(true);

    const huge = await request(app.getHttpServer())
      .get('/api/rooms')
      .set(bearer(employee.token))
      .query({ minCapacity: 500 })
      .expect(200);
    expect(huge.body).toHaveLength(0);
  });

  it('возвращает занятые интервалы комнаты на запрошенный период', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set(bearer(employee.token))
      .send({ roomId, title: 'Занятость', startTime: at(10), endTime: at(11) })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/rooms/${roomId}/availability`)
      .set(bearer(employee.token))
      .query({ from: at(9), to: at(18) })
      .expect(200);
    expect(res.body.busy).toHaveLength(1);
    expect(res.body.busy[0].title).toBe('Занятость');

    const empty = await request(app.getHttpServer())
      .get(`/api/rooms/${roomId}/availability`)
      .set(bearer(employee.token))
      .query({ from: at(12), to: at(18) })
      .expect(200);
    expect(empty.body.busy).toHaveLength(0);
  });

  it('для несуществующей комнаты отвечает 404, для некорректного идентификатора — 400', async () => {
    await request(app.getHttpServer())
      .get('/api/rooms/00000000-0000-4000-8000-000000000000/availability')
      .set(bearer(employee.token))
      .query({ from: at(9), to: at(18) })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/rooms/not-a-uuid/availability')
      .set(bearer(employee.token))
      .query({ from: at(9), to: at(18) })
      .expect(400);
  });
});
