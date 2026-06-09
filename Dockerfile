# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.34.1

FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Corepack ships with Node 22+ and pins the pnpm version declared in
# package.json (packageManager), so this is reproducible.
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
 && pnpm run build

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

RUN apk add --no-cache wget \
    && addgroup -S koom && adduser -S koom -G koom

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER koom

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://localhost:8080/health || exit 1

CMD ["node", "dist/main.js"]
