import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// passwordHash — заглушка до появления модуля авторизации
const PLACEHOLDER_HASH = 'set-by-auth-module';

async function main() {
  const users = [
    { email: 'employee@example.com', fullName: 'Иван Петров', role: 'EMPLOYEE', department: 'Разработка' },
    { email: 'manager@example.com', fullName: 'Мария Смирнова', role: 'OFFICE_MANAGER', department: 'АХО' },
    { email: 'admin@example.com', fullName: 'Алексей Админов', role: 'ADMIN', department: 'ИТ' },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: PLACEHOLDER_HASH },
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
}

main().finally(() => prisma.$disconnect());
