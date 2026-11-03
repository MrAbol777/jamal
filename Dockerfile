# ایمیج پایه قابل تغییر است (برای سرورهای ایران: میرور داکر هاب، مثلاً
#   --build-arg BASE_IMAGE=docker.arvancloud.ir/library/node:22-slim )
ARG BASE_IMAGE=node:22-slim
FROM ${BASE_IMAGE}

# همه اختیاری‌اند؛ خالی یعنی استفاده از آدرس‌های پیش‌فرض.
# NPM_REGISTRY: میرور npm (مثلاً https://registry.npmmirror.com)
# PRISMA_ENGINES_MIRROR: میرور فایل‌های موتور Prisma
# DEBIAN_MIRROR: میرور Debian به‌جای http://deb.debian.org/debian (مثلاً http://mirror.arvancloud.ir/debian)
ARG NPM_REGISTRY=
ARG PRISMA_ENGINES_MIRROR=
ARG DEBIAN_MIRROR=

# Chromium برای ساخت PDF + openssl برای Prisma
RUN set -eu; \
    if [ -n "$DEBIAN_MIRROR" ]; then \
      for f in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do \
        if [ -f "$f" ]; then sed -i "s|http://deb.debian.org/debian|$DEBIAN_MIRROR|g" "$f"; fi; \
      done; \
    fi; \
    apt-get -o Acquire::Retries=5 update; \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends chromium openssl ca-certificates; \
    rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY package.json package-lock.json ./
# اسکیمای Prisma قبل از npm ci لازم است (postinstall دستور prisma generate را اجرا می‌کند)
COPY prisma ./prisma
# devDependencies (tailwind, typescript) برای build لازم‌اند.
# آدرس دیتابیس فقط برای ساخت Prisma Client است و در ایمیج ذخیره نمی‌شود.
RUN set -eu; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    if [ -n "$PRISMA_ENGINES_MIRROR" ]; then export PRISMA_ENGINES_MIRROR; else unset PRISMA_ENGINES_MIRROR; fi; \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    npm ci --include=dev --no-audit --no-fund \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000

COPY . .
RUN set -eu; \
    if [ -n "$PRISMA_ENGINES_MIRROR" ]; then export PRISMA_ENGINES_MIRROR; else unset PRISMA_ENGINES_MIRROR; fi; \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    npm run build

EXPOSE 10000
# اول مایگریشن‌های دیتابیس اعمال می‌شود، بعد برنامه بالا می‌آید.
# DATABASE_URL و DIRECT_URL باید هنگام اجرا تنظیم شده باشند.
# SKIP_MIGRATIONS=1 فقط برای محیطی که مایگریشن را جدا اجرا می‌کند (مثلاً Render با دیتابیس فقط-IPv6).
# Render پورت را در PORT می‌دهد.
CMD ["sh", "-c", "if [ \"${SKIP_MIGRATIONS:-0}\" != \"1\" ]; then npx prisma migrate deploy || exit 1; fi; exec npx next start -p ${PORT:-10000} -H 0.0.0.0"]
