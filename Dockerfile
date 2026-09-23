# syntax=docker/dockerfile:1

# Образ приложения для боевого сервера (deploy/README.md).
#
# Сборка идёт на платформе машины, где запущен `docker build` ($BUILDPLATFORM),
# а итоговый образ — под платформу сервера (`--platform linux/amd64`). На Mac
# с Apple Silicon это значит: `next build` работает нативно и быстро, а не
# под эмуляцией x86. Переносить результат между платформами безопасно, потому
# что в standalone-выводе нет нативных модулей, которые сервер исполняет:
# клиент Prisma 7 с драйвером `pg` — чистый JS и wasm, пароли хешируются
# встроенным `node:crypto`, `next/image` не используется (sharp не вызывается).

ARG NODE_VERSION=22

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Зависимости отдельным слоем: пока lock-файл и схема не менялись, `npm ci`
# берётся из кеша. `postinstall` генерирует клиент Prisma, ему нужны схема
# и конфиг; адрес базы для генерации не нужен, но конфиг его читает.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://build@localhost/build npm ci

COPY . .
# sharp нужен только оптимизатору `next/image`, а он в проекте не используется
# (картинки закрыты входом, см. announcement-card.tsx). Next кладёт его в
# standalone трассировкой собственного сервера, `outputFileTracingExcludes`
# туда не достаёт — и в образ ехали бы ~45 МБ сборок под платформу сборки,
# на сервере всё равно неработающих.
RUN npm run build \
 && rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Статика в standalone не копируется сама (документация `output`), папки
# `public` в проекте нет.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
