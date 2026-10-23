FROM node:22-slim

# Chromium برای ساخت PDF + openssl برای Prisma
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY package.json package-lock.json ./
# devDependencies (tailwind, typescript) برای build لازم‌اند
RUN npm ci --include=dev
COPY . .
# فقط برای تولید Prisma Client؛ به دیتابیس وصل نمی‌شود
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build
ENV DATABASE_URL="" DIRECT_URL=""

EXPOSE 10000
# Render پورت را در PORT می‌دهد
CMD ["sh", "-c", "npx next start -p ${PORT:-10000} -H 0.0.0.0"]
