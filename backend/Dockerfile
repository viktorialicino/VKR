# Серверная часть: сборка и запуск NestJS-приложения
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Клиент Prisma генерируется в src/generated (в репозиторий не входит) и нужен для компиляции
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
# Применяем миграции (в т.ч. ограничения EXCLUDE) и запускаем сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
