// Нагрузочное тестирование (НФТ-1, НФТ-5): N виртуальных пользователей одновременно
// листают календарь, запрашивают оборудование и создают/отменяют брони.
// Запуск: npm run test:load (backend должен быть запущен, база засеяна).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/client.js';

const BASE = process.env.LOAD_BASE_URL ?? 'http://localhost:3001/api';
const USERS = Number(process.env.LOAD_USERS ?? 50);
const SECONDS = Number(process.env.LOAD_SECONDS ?? 30);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const samples: Record<string, number[]> = {};
const errors: Record<string, number> = {};

async function timed(name: string, token: string, path: string, init: RequestInit = {}, ok: number[] = [200]) {
  const t0 = performance.now();
  let status = 0;
  let body: any = null;
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch {
    status = 0;
  }
  (samples[name] ??= []).push(performance.now() - t0);
  if (!ok.includes(status)) errors[name] = (errors[name] ?? 0) + 1;
  return body;
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@example.com', password: 'password123' }),
  }).then((r) => r.json());
  const token: string = login.accessToken;

  const room = await prisma.room.create({ data: { name: `load-${Date.now()}`, floor: 1, capacity: 10 } });
  const day0 = Date.now() + 100 * 86_400_000;
  const stopAt = Date.now() + SECONDS * 1000;
  const weekFrom = new Date(day0).toISOString();
  const weekTo = new Date(day0 + 7 * 86_400_000).toISOString();

  async function virtualUser(i: number) {
    // у каждого пользователя свои сутки, поэтому пересечений между ними нет
    const dayStart = day0 + (i % 7) * 86_400_000; // семь суток недели по кругу
    let iteration = 0;
    while (Date.now() < stopAt) {
      await timed('GET /bookings (календарь)', token, `/bookings?roomId=${room.id}&from=${weekFrom}&to=${weekTo}`);
      await timed('GET /resources (занятость)', token, `/resources?from=${weekFrom}&to=${weekTo}`);
      await timed('GET /rooms', token, '/rooms');
      if (iteration % 4 === 0) {
        // 15-минутный слот со смещением, зависящим от пользователя и итерации, чтобы слоты не совпадали
        const slot = (i * 40 + iteration) % 96;
        const start = new Date(dayStart + slot * 15 * 60_000);
        const created = await timed(
          'POST /bookings (создание)',
          token,
          '/bookings',
          {
            method: 'POST',
            body: JSON.stringify({
              roomId: room.id,
              title: `load ${i}-${iteration}`,
              startTime: start.toISOString(),
              endTime: new Date(start.getTime() + 15 * 60_000).toISOString(),
            }),
          },
          [201, 409], // 409 допустим: слоты разных пользователей могут совпасть — это штатный отказ
        );
        if (created?.id) await timed('DELETE /bookings/:id (отмена)', token, `/bookings/${created.id}`, { method: 'DELETE' });
      }
      iteration++;
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: USERS }, (_, i) => virtualUser(i)));
  const elapsed = (performance.now() - started) / 1000;

  // Гонка за один и тот же слот: USERS одновременных запросов -> ровно одна бронь
  const raceStart = new Date(day0 + 20 * 86_400_000);
  const race = await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          title: `race ${i}`,
          startTime: raceStart.toISOString(),
          endTime: new Date(raceStart.getTime() + 3_600_000).toISOString(),
        }),
      }).then((r) => r.status),
    ),
  );

  let total = 0;
  console.log(`\nПользователей: ${USERS}, длительность: ${elapsed.toFixed(1)} с`);
  console.log('| Запрос | Кол-во | p50, мс | p95, мс | p99, мс | max, мс | Ошибок |');
  console.log('|---|---|---|---|---|---|---|');
  for (const [name, values] of Object.entries(samples)) {
    const s = [...values].sort((a, b) => a - b);
    total += s.length;
    console.log(
      `| ${name} | ${s.length} | ${percentile(s, 50).toFixed(0)} | ${percentile(s, 95).toFixed(0)} | ${percentile(s, 99).toFixed(0)} | ${s[s.length - 1].toFixed(0)} | ${errors[name] ?? 0} |`,
    );
  }
  console.log(`\nВсего запросов: ${total}, пропускная способность: ${(total / elapsed).toFixed(0)} запросов/с`);
  console.log(
    `Гонка за один слот (${USERS} запросов): создано ${race.filter((c) => c === 201).length}, отклонено 409: ${race.filter((c) => c === 409).length}, прочее: ${race.filter((c) => c !== 201 && c !== 409).length}`,
  );

  await prisma.bookingResource.deleteMany({ where: { booking: { roomId: room.id } } });
  await prisma.booking.deleteMany({ where: { roomId: room.id } });
  await prisma.room.delete({ where: { id: room.id } });
}

void main().finally(() => prisma.$disconnect());
