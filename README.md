# DFS — Distributed File System

**🌐 Landing page:** [https://sohaibirfann.github.io/dfs/](https://sohaibirfann.github.io/dfs/)

A private, invite-only app for sharing files inside a small group, where every
file is **end-to-end encrypted on your device** and stored **across the group
members' own machines** instead of a company's cloud.

> Mental model: *"WhatsApp groups, but for file storage."* You make a group,
> invite a few people, and your files live distributed across just those members.

## How it works

1. **Encrypt** — A file is encrypted in the browser (AES-256-GCM, Web Crypto)
   with the group's key, then split into chunks. Plaintext never leaves the device.
2. **Distribute** — Encrypted chunks are spread across the group's machines with
   configurable replication, so a file survives members going offline.
3. **Access** — Any member fetches the chunks and decrypts on-device with the
   shared group key.

The **coordinator** is a lightweight cloud service that acts as a phonebook +
traffic controller: it tracks which groups/members exist, who's online, and which
encrypted chunk lives where. It holds **no files and no keys**. Group keys live
only on members' devices, delivered through a group's invite.

> Honest nuance: today the coordinator may briefly relay **encrypted** chunks;
> moving transfers fully peer-to-peer (WebRTC) is on the roadmap. Either way it
> never touches plaintext or keys.

## Repo layout

| Path        | What it is |
|-------------|-----------|
| `backend/`  | The coordinator (Express + SQLite + Socket.io) and a standalone storage-node server (`nodeServer.js`) for dev/headless use. |
| `frontend/` | The React + Vite app (UI). Bundled into the desktop client; also runs in the browser for dev. |
| `desktop/`  | The Electron shell — frameless window, settings, and an **embedded storage node**. |
| `landing/`  | A self-contained static landing page (`index.html`, all assets inline). |
| `spike/`    | WebRTC signaling/peer experiments (not part of the app yet). |

## Quick start (dev)

**Prerequisites:** Node.js 18+.

```bash
# 1. Install deps (root + each package)
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix desktop install

# 2. Configure the coordinator's secrets
cp backend/.env.example backend/.env
# then fill JWT_SECRET and NODE_SECRET — generate each with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3a. Run everything (coordinator + a storage node + web UI + desktop app)
npm run dev

# 3b. …or just the web stack, no Electron window
npm run dev:web
```

Default ports: coordinator on **5000**, web UI on **5173**, the dev storage node
on **7001**.

### Useful scripts

| Command | Where | Does |
|---|---|---|
| `npm run dev` | root | coordinator + storage node + web + desktop |
| `npm run dev:web` | root | coordinator + storage node + web (no desktop) |
| `npm start` | `backend/` | run the coordinator (`node app.js`) |
| `npm run node1` | `backend/` | run a standalone storage node on :7001 |
| `npm test` | `backend/` | backend group tests |
| `npm run dev` / `build` | `frontend/` | Vite dev server / production build |
| `npm start` | `desktop/` | launch the Electron app |

## Pointing the app at a coordinator

The coordinator address is **runtime-configurable** on desktop — no rebuild needed:

- **First run:** the app shows a "Connect to a coordinator" screen.
- **Anytime:** Settings → **Connection**.

The build-time default lives in `frontend/.env` (`VITE_API_URL`) and is only a
fallback; the in-app value (stored per-device) overrides it.

To test against a deployed-feeling coordinator without a server, expose your
local coordinator with a free tunnel and paste the URL into the app:

```bash
cloudflared tunnel --url http://localhost:5000
```

## Security model

- **AES-256-GCM**, client-side, before anything is uploaded.
- **Keys live only on devices**, shared through a group's invite — never sent to
  or stored on a server.
- **Zero-knowledge coordinator** — metadata only (groups, presence, chunk map).
- **Group isolation** — two groups can't see or decrypt each other's data.

## Status

Desktop client with end-to-end encrypted, replicated, group-based file sharing.
Works today over HTTP on the same network as the coordinator; cross-network
peer-to-peer transfer (WebRTC) and packaged installers are next.
