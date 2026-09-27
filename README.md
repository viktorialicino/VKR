# Бронирование переговорных комнат и учёт офисных ресурсов

Дипломный проект (Личино В., НИУ «МЭИ»). Стек: NestJS 12 + Prisma 7 + PostgreSQL 16 + Socket.IO (backend), React 19 + Vite + MUI + FullCalendar + RTK Query (frontend), Docker Compose.

## Запуск

1. Инфраструктура (PostgreSQL на :5432):
   ```bash
   docker compose up -d
   ```
2. Backend (http://localhost:3001, Swagger — http://localhost:3001/api/docs):
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma migrate deploy
   npx prisma generate
   npx prisma db seed
   npm run start:dev
   ```
3. Frontend (http://localhost:5173):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Тесты

`cd backend && npm test` — модульные (правила бронирования), с поднятой базой `npm run test:e2e` — интеграционные.

## Структура

- `backend/prisma/` — схема БД, миграции (в т.ч. ограничения EXCLUDE от пересечения броней), seed
- `backend/src/{rooms,bookings,resources,users}` — модули; `bookings.gateway.ts` — WebSocket
- `frontend/src/features/bookings` — календарь и форма бронирования
# VKR
