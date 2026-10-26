# syntax=docker/dockerfile:1.4

FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
RUN npm run build && npm prune --omit=dev && npx prisma generate

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Europe/Madrid

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/pulso-entrypoint
RUN chmod +x /usr/local/bin/pulso-entrypoint \
  && chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/pulso-entrypoint"]
