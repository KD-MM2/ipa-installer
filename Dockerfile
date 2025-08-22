# syntax=docker.io/docker/dockerfile:1
FROM node:20-alpine

RUN apk add --no-cache libc6-compat zip unzip

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY . .

RUN corepack enable pnpm
RUN pnpm i --frozen-lockfile
RUN pnpx prisma generate
RUN pnpm run build

EXPOSE 3000
