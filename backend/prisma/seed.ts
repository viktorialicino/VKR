import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Пароль для всех демо-аккаунтов сидинга — только для локальной разработки
const DEMO_PASSWORD = 'password123';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    { email: 'employee@example.com', fullName: 'Иван Петров', role: 'EMPLOYEE', department: 'Разработка' },
    { email: 'manager@example.com', fullName: 'Мария Смирнова', role: 'OFFICE_MANAGER', department: 'АХО' },
    { email: 'admin@example.com', fullName: 'Алексей Админов', role: 'ADMIN', department: 'ИТ' },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash },
      create: { ...u, passwordHash },
    });
  }

  const rooms = [
    { name: 'Байкал', floor: 1, capacity: 6 },
    { name: 'Эльбрус', floor: 2, capacity: 12 },
    { name: 'Алтай', floor: 2, capacity: 4 },
    { name: 'Зал совещаний', floor: 3, capacity: 30 },
  ];
  for (const r of rooms) {
    await prisma.room.upsert({ where: { name: r.name }, update: {}, create: r });
  }

  const resources = [
    { name: 'Проектор Epson EB-X49', type: 'projector', inventoryNumber: 'PRJ-001' },
    { name: 'Проектор BenQ MW550', type: 'projector', inventoryNumber: 'PRJ-002' },
    { name: 'Ноутбук Lenovo ThinkPad', type: 'laptop', inventoryNumber: 'LTP-001' },
    { name: 'Система видеоконференцсвязи Logitech Rally', type: 'vks', inventoryNumber: 'VKS-001' },
    { name: 'Флипчарт', type: 'flipchart', inventoryNumber: 'FLP-001' },
  ];
  for (const r of resources) {
    await prisma.resource.upsert({ where: { inventoryNumber: r.inventoryNumber }, update: {}, create: r });
  }

  console.log('Seed выполнен: пользователи, комнаты, ресурсы');
  console.log(`Демо-пароль для всех сидированных пользователей: ${DEMO_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
