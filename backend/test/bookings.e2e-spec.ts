import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Бронирование (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let roomId: string;
  let otherRoomId: string;
  let resourceId: string;

  const tag = `e2e-${Date.now()}`;
  // Рабочее время считается в поясе компании (по умолчанию Europe/Moscow, UTC+3)
  const ymd = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const at = (h: number, m = 0) =>
    new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`).toISOString();

  const book = (over: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .send({ roomId, userId, title: tag, ...over });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    userId = (await prisma.user.findUniqueOrThrow({ where: { email: 'employee@example.com' } })).id;
    roomId = (await prisma.room.create({ data: { name: `${tag}-a`, floor: 1, capacity: 4 } })).id;
    otherRoomId = (await prisma.room.create({ data: { name: `${tag}-b`, floor: 1, capacity: 4 } })).id;
    resourceId = (
      await prisma.resource.create({ data: { name: `${tag} проектор`, type: 'projector', inventoryNumber: tag } })
    ).id;
  });

  afterAll(async () => {
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
    await request(app.getHttpServer()).delete(`/api/bookings/${created.body.id}`).expect(200);
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
      .query({ from: at(10), to: at(11) })
      .expect(200);
    expect(busy.body.find((r: { id: string }) => r.id === resourceId).busy).toBe(true);

    const free = await request(app.getHttpServer())
      .get('/api/resources')
      .query({ from: at(16), to: at(17) })
      .expect(200);
    expect(free.body.find((r: { id: string }) => r.id === resourceId).busy).toBe(false);

    await prisma.resource.update({ where: { id: resourceId }, data: { status: 'IN_REPAIR' } });
    await book({ startTime: at(16), endTime: at(17), resourceIds: [resourceId] }).expect(409);
    await prisma.resource.update({ where: { id: resourceId }, data: { status: 'AVAILABLE' } });
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
