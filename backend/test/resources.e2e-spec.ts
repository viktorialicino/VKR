import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, createTestApp, loginAs } from './helpers.js';

describe('Учёт офисных ресурсов (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employee: { token: string; id: string };
  let manager: { token: string; id: string };
  let resourceId: string;
  const inventoryNumber = `RES-E2E-${Date.now()}`;

  // holderId: не передан – для выдачи берётся сотрудник employee; null – получатель не указывается
  const setStatus = (token: string, action: string, holderId?: string | null) =>
    request(app.getHttpServer())
      .patch(`/api/resources/${resourceId}/status`)
      .set(bearer(token))
      .send({ action, holderId: holderId === null ? undefined : (holderId ?? (action === 'issue' ? employee.id : undefined)) });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    employee = await loginAs(app, 'employee');
    manager = await loginAs(app, 'manager');
  });

  afterAll(async () => {
    const mine = await prisma.resource.findMany({
      where: { inventoryNumber: { startsWith: inventoryNumber } },
      select: { id: true },
    });
    const ids = mine.map((r) => r.id);
    await prisma.resourceLog.deleteMany({ where: { resourceId: { in: ids } } });
    await prisma.resource.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('регистрация ресурса: сотруднику — 403, офис-менеджеру — 201', async () => {
    const body = { name: 'Тестовый проектор', type: 'projector', inventoryNumber };
    await request(app.getHttpServer()).post('/api/resources').set(bearer(employee.token)).send(body).expect(403);
    const res = await request(app.getHttpServer())
      .post('/api/resources')
      .set(bearer(manager.token))
      .send(body)
      .expect(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('AVAILABLE');
    resourceId = res.body[0].id;
  });

  it('повторная регистрация того же инвентарного номера отклоняется (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/resources')
      .set(bearer(manager.token))
      .send({ name: 'Дубликат', type: 'projector', inventoryNumber })
      .expect(409);
  });

  it('создаёт несколько одинаковых единиц с отдельными инвентарными номерами и продолжает нумерацию', async () => {
    const send = (quantity: number) =>
      request(app.getHttpServer())
        .post('/api/resources')
        .set(bearer(manager.token))
        .send({ name: 'Тестовый ноутбук', type: 'laptop', inventoryNumber: `${inventoryNumber}-NB`, quantity })
        .expect(201);
    const first = (await send(2)).body as { inventoryNumber: string }[];
    expect(first.map((r) => r.inventoryNumber)).toEqual([`${inventoryNumber}-NB-001`, `${inventoryNumber}-NB-002`]);
    const next = (await send(1)).body as { inventoryNumber: string }[];
    expect(next).toHaveLength(1);
    const more = (await send(2)).body as { inventoryNumber: string }[];
    expect(more.map((r) => r.inventoryNumber)).toEqual([`${inventoryNumber}-NB-003`, `${inventoryNumber}-NB-004`]);
  });

  it('отклоняет недопустимое количество (400) с сообщением на русском', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/resources')
      .set(bearer(manager.token))
      .send({ name: 'Много', type: 'laptop', inventoryNumber: `${inventoryNumber}-X`, quantity: 500 })
      .expect(400);
    expect(res.body.message).toEqual(['Количество: значение не может быть больше 50']);
  });

  it('сотрудник не может менять статус ресурса (403)', async () => {
    await setStatus(employee.token, 'issue').expect(403);
  });

  it('выдача требует сотрудника-получателя и закрепляет за ним ресурс до возврата', async () => {
    await setStatus(manager.token, 'issue', null).expect(400);
    await setStatus(manager.token, 'issue', '00000000-0000-4000-8000-000000000000').expect(404);
    const issued = (await setStatus(manager.token, 'issue', employee.id).expect(200)).body;
    expect(issued.status).toBe('ISSUED');
    expect(issued.holder.id).toBe(employee.id);
    const list = (await request(app.getHttpServer()).get('/api/resources').set(bearer(employee.token)).expect(200)).body;
    expect(list.find((r: { id: string }) => r.id === resourceId).holder.id).toBe(employee.id);
    const returned = (await setStatus(manager.token, 'return').expect(200)).body;
    expect(returned.holder).toBeNull();
  });

  it('проходит цикл «выдать → принять → в ремонт → вернуть в работу»', async () => {
    expect((await setStatus(manager.token, 'issue').expect(200)).body.status).toBe('ISSUED');
    expect((await setStatus(manager.token, 'return').expect(200)).body.status).toBe('AVAILABLE');
    expect((await setStatus(manager.token, 'repair').expect(200)).body.status).toBe('IN_REPAIR');
    expect((await setStatus(manager.token, 'return').expect(200)).body.status).toBe('AVAILABLE');
  });

  it('запрещает недопустимые переходы: выдать уже выданный, выдать ресурс из ремонта (400)', async () => {
    await setStatus(manager.token, 'issue').expect(200);
    await setStatus(manager.token, 'issue').expect(400);
    await setStatus(manager.token, 'repair').expect(200);
    await setStatus(manager.token, 'issue').expect(400);
    await setStatus(manager.token, 'return').expect(200);
  });

  it('отклоняет неизвестное действие (400) и несуществующий ресурс (404)', async () => {
    await setStatus(manager.token, 'destroy').expect(400);
    await request(app.getHttpServer())
      .patch('/api/resources/00000000-0000-4000-8000-000000000000/status')
      .set(bearer(manager.token))
      .send({ action: 'issue' })
      .expect(404);
  });

  it('пишет журнал операций: каждая смена статуса — отдельная запись с автором', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/resources/${resourceId}/history`)
      .set(bearer(employee.token))
      .expect(200);
    // выдача и возврат (2) + цикл (4) + проверка переходов (3) = 9
    expect(res.body).toHaveLength(9);
    expect(res.body[0].user.id).toBe(manager.id);
    expect(res.body.find((e: { action: string }) => e.action === 'ISSUED').holder.id).toBe(employee.id);
    expect(res.body.map((e: { action: string }) => e.action)).toContain('TO_REPAIR');
  });

  it('фильтрует список по статусу', async () => {
    await setStatus(manager.token, 'repair').expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/resources')
      .set(bearer(employee.token))
      .query({ status: 'IN_REPAIR' })
      .expect(200);
    expect(res.body.some((r: { id: string }) => r.id === resourceId)).toBe(true);
    expect(res.body.every((r: { status: string }) => r.status === 'IN_REPAIR')).toBe(true);
  });
});
