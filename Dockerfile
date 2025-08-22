# syntax=docker.io/docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ----------------------
# deps: install packages
# ----------------------
FROM base AS deps
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

# ----------------------
# builder: build app
# ----------------------
FROM base AS builder
RUN corepack enable pnpm
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpx prisma generate
RUN pnpm run build
RUN pnpm exec tsc -p tsconfig.worker.json

# ----------------------
# runner: final image
# ----------------------
FROM base AS runner
RUN apk add --no-cache supervisor zip unzip
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Worker
COPY --from=builder /app/worker ./worker

# Copy supervisor config
COPY supervisord.conf /etc/supervisord.conf

USER nextjs
EXPOSE 3000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
