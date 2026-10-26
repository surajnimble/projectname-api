# syntax=docker/dockerfile:1

# The API is a long-running Express process with Socket.IO and BullMQ workers,
# so it runs as a Cloudflare Container rather than a Worker. Cloudflare runs
# linux/amd64 images; build this image for that platform.

FROM node:22-bookworm-slim AS deps

WORKDIR /app
ENV HUSKY=0

# bcrypt compiles from source when a prebuilt binary is unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM deps AS build

COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV HUSKY=0

# Prisma's query engine links against OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy from the build stage so the generated Prisma client is included.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY scripts/seed-if-empty.ts ./scripts/seed-if-empty.ts
COPY cloudflare/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir -p uploads/tmp \
  && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
