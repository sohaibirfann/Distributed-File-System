# ── DFS coordinator (control plane) ──────────────────────────────────────────
# Multi-stage: build the native better-sqlite3 addon in a toolchain image, then
# run on a slim runtime. Secrets (JWT_SECRET, NODE_SECRET) are passed as env at
# run time — never baked into the image.

# 1) Install production deps (needs python/make/g++ to compile better-sqlite3)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 2) Runtime
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000 \
    DFS_DB_PATH=/data/dfs.db
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# SQLite (group/file metadata) lives on a mounted volume so it survives restarts.
RUN mkdir -p /data
EXPOSE 5000
CMD ["node", "app.js"]
