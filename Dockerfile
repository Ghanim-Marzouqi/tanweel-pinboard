# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install deps & generate Prisma client ----------
FROM node:26-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json
RUN npx prisma generate

# ---------- Stage 2: build the Next.js app ----------
FROM node:26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 3: minimal runtime ----------
FROM node:26-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Next.js standalone reads HOSTNAME to decide its bind address. Default of
# `localhost` makes Node bind to the container's eth0 IP only — wget from
# the healthcheck (which targets 127.0.0.1:3000) then gets refused, so
# Docker reports the container unhealthy and Traefik filters it out.
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Production-only deps so we get the Prisma CLI + pg driver + adapters at
# runtime (used by docker-entrypoint.sh to provision the DB and apply
# migrations before Next.js starts).
COPY --chown=nextjs:nodejs package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Standalone Next.js output (its own copy of trace-resolved node_modules
# lives under .next/standalone/node_modules — Next.js will use that, while
# our entrypoint uses the install above).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma assets needed by the entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Uploaded attachments live here (mount the `uploads` volume on it). Created
# with the runtime user's ownership so a fresh named volume inherits it.
ENV UPLOADS_DIR=/app/storage
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage

# First-admin bootstrap / `create-user` CLI (plain Node, uses pg + argon2)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
