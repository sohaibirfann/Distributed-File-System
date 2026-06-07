# DFS — Distributed File System

**🌐 Landing page:** [https://sohaibirfann.github.io/dfs/](https://sohaibirfann.github.io/dfs/)

A private, invite-only desktop app for sharing files inside a small group — where
every file is **end-to-end encrypted on your device** and stored **across the
group members' own machines** instead of a company's cloud.

> **Mental model:** *"WhatsApp groups, but for file storage."* One person in the
> group runs a small coordinator on the local network; everyone installs the app,
> joins with an invite, and files live distributed across just those members. No
> central service, no company holding your data.

---

## Table of contents
- [Features](#features)
- [How it works](#how-it-works)
- [Getting started (for a group)](#getting-started-for-a-group)
- [Hosting the coordinator](#hosting-the-coordinator)
- [Security model](#security-model)
- [Tech stack](#tech-stack)
- [Repo layout](#repo-layout)
- [Development](#development)
- [Build & release](#build--release)
- [Limitations & scope](#limitations--scope)
- [License](#license)

---

## Features

**Privacy & storage**
- 🔒 **End-to-end encrypted** — files are encrypted on your device (AES-256-GCM)
  before they ever leave it. The server only ever sees ciphertext.
- 🧩 **Distributed** — each file is chunked and spread across the group's machines
  with a per-group **replication preset** (minimal / balanced / max), so files
  survive members going offline.
- 🕵️ **Zero-knowledge coordinator** — the server holds **no files and no keys**,
  only metadata (groups, presence, which chunk lives where).

**Groups & invites**
- 👥 Invite-only **groups** with owner/member roles, rename + emoji/color identity,
  transfer ownership, leave/remove members.
- 🎟️ **Invites** with expiry presets, **one-time-use** codes, revocation, and a
  per-invite "who redeemed it" list.
- 🟢 **Member presence** (who's online) and **per-member storage contribution**.

**Files**
- ⬆️⬇️ Background **uploads/downloads** with live progress in a docked transfer
  panel (Transfers / Completed tabs, minimizes to a progress ring).
- 🖼️ **Gallery + list** views; **image/video/PDF/text previews** with a lightbox
  (←/→ navigation); **encrypted thumbnails** generated at upload so previews are
  cheap.
- ✅ **Multi-select** → bulk **download (zip or individual)** and bulk delete;
  rename; overwrite confirmation; drag-and-drop upload.

**Desktop**
- 🖥️ Native Electron app — frameless window, live connection indicator, **desktop
  notifications** (file added / member joined), themes, configurable coordinator
  address, embedded storage node, and **auto-update**.

---

## How it works

```
                   ┌──────────────────────────────┐
                   │   COORDINATOR (self-hosted)   │   ← run by one group member
                   │   control plane only          │     on the local network
                   │   • groups / members / presence│
                   │   • chunk → node map           │
                   │   • relays ciphertext          │
                   │   • NO files, NO keys          │
                   └───────────────┬───────────────┘
                          HTTP on the LAN
        ┌────────────────────┬─────┴──────┬────────────────────┐
   ┌────▼────┐          ┌────▼────┐   ┌────▼────┐          ┌────▼────┐
   │ Member  │          │ Member  │   │ Member  │          │ Member  │
   │ app +   │          │ app +   │   │ app +   │          │ app +   │
   │ storage │          │ storage │   │ storage │          │ storage │
   └─────────┘          └─────────┘   └─────────┘          └─────────┘
   Encrypted chunks are stored across members that contribute storage.
```

1. **Encrypt** — a file is encrypted on your device with the group's key, then
   split into chunks. Plaintext never leaves the device.
2. **Distribute** — encrypted chunks are spread across members' storage nodes
   (with replication), coordinated by the server, which only ever relays
   ciphertext.
3. **Access** — any member fetches the chunks and decrypts on-device with the
   shared group key (delivered through the group's invite).

---

## Getting started (for a group)

You need **one** machine to act as the host (runs the coordinator); everyone else
just installs the app.

### Host (one person)
1. **Run the coordinator** from this repo — Docker or Node
   (see [backend/DEPLOY.md](backend/DEPLOY.md)). It prints its address, e.g.
   `http://192.168.1.50:5000`.
2. **Open the firewall** — run `backend/open-firewall.ps1` as Administrator (opens
   the coordinator + storage-node ports on your local network).

### Everyone (including the host)
3. **Install the app** — download `DFS Setup <version>.exe` from
   [Releases](https://github.com/sohaibirfann/Distributed-File-System/releases) and
   run it. (It's unsigned, so Windows SmartScreen shows a warning → **More info →
   Run anyway**.)
4. **Connect** — on first launch, enter the **host's address**
   (`http://192.168.1.50:5000`). The dot in the title bar turns green when connected.
5. **Sign up.** The host creates a group and shares an **invite**; others use
   **Join with code**.
6. **Contribute storage** — in **Settings → Storage**, turn on **Contribute** on
   the machines that should hold the group's files (at least one).
7. **Share files** — upload a file; it's encrypted on your device and distributed
   to the group. Anyone in the group can download and decrypt it.

---

## Hosting the coordinator

The coordinator is a small Node/Express + SQLite + Socket.io server. One group
member runs it; it holds no files or keys. Full instructions, including a Docker
Compose setup, are in **[backend/DEPLOY.md](backend/DEPLOY.md)**. In short:

```bash
cd backend
cp .env.example .env        # set JWT_SECRET (and NODE_SECRET for dev nodes)
docker compose up -d --build    # or: node app.js
```

It prints `http://<your-lan-ip>:5000` on startup — that's the address members
enter. Members authenticate their storage node with their own login (JWT), so the
host doesn't need to hand out any shared secret.

---

## Security model

- **AES-256-GCM**, performed **client-side** before anything is uploaded.
- **Keys live only on devices** — a group's key is generated on-device and shared
  through the group's invite link; it is never sent to or stored on the server.
- **Zero-knowledge coordinator** — it stores metadata only (groups, presence,
  chunk→node map) and only ever relays ciphertext.
- **Group isolation** — each group has its own key; groups can't see or decrypt
  each other's data.
- **Integrity** — each chunk is SHA-256 hashed; corrupted/tampered chunks are
  rejected on download.

> Honest caveats (see [Limitations](#limitations--scope)): the group key is a
> bearer secret carried in the invite, it lives only on the device (no built-in
> backup/recovery beyond re-inviting), and the installer is unsigned.

---

## Tech stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron (frameless window, embedded storage node, auto-update) |
| UI | React + Vite + Tailwind CSS v4 |
| Coordinator | Node.js + Express + Socket.io |
| Storage | SQLite (`better-sqlite3`) for metadata; encrypted chunks on members' disks |
| Crypto | Web Crypto API (AES-256-GCM), client-side |

---

## Repo layout

| Path | What it is |
|------|-----------|
| `backend/`  | The coordinator (Express + SQLite + Socket.io) and a standalone storage-node server (`nodeServer.js`) for dev/headless use. Includes `DEPLOY.md` and `open-firewall.ps1`. |
| `frontend/` | The React + Vite app (UI), bundled into the desktop client. |
| `desktop/`  | The Electron shell — window, settings, embedded storage node, packaging + auto-update (`RELEASING.md`). |

---

## Development

**Prerequisites:** Node.js 18+.

```bash
npm install
npm --prefix backend install && npm --prefix frontend install && npm --prefix desktop install

# coordinator secrets
cp backend/.env.example backend/.env   # fill JWT_SECRET, NODE_SECRET
# generate each: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev        # coordinator + storage node + web UI + desktop app
npm run dev:web    # …without the Electron window
```

Default ports: coordinator **5000**, web UI **5173**, dev storage node **7001**.

| Command | Where | Does |
|---|---|---|
| `npm run dev` | root | coordinator + storage node + web + desktop |
| `npm run dev:web` | root | same, without the Electron window |
| `npm run tunnel` | root | coordinator + a Cloudflare quick tunnel (expose it temporarily) |
| `npm start` | `backend/` | run the coordinator (`node app.js`) |
| `npm run node1` | `backend/` | run a standalone storage node on :7001 |
| `npm test` | `backend/` | backend group tests |
| `npm run dev` / `build` | `frontend/` | Vite dev server / production build |
| `npm run pack` / `dist` | `desktop/` | unpacked build / installer |

---

## Build & release

- **Package the app:** `cd desktop && npm install && npm run dist` →
  `desktop/release/DFS Setup <version>.exe`. On Windows, enable **Developer Mode**
  so the build's signing-tool extraction succeeds.
- **Ship updates:** the app auto-updates from GitHub Releases. Bump the version,
  build with `--publish`, publish the draft release — details in
  [desktop/RELEASING.md](desktop/RELEASING.md).

---

## Limitations & scope

- **LAN / self-hosted only.** The coordinator must be reachable by all members —
  i.e. one local network (or a coordinator the group exposes themselves, e.g. via
  a tunnel/VPS). Cross-internet peer-to-peer (WebRTC) was explored but is **out of
  scope**.
- **Bytes relay through the coordinator** (still ciphertext) rather than flowing
  directly peer-to-peer.
- **Group key is device-local** — clearing app storage or moving devices means
  re-joining via an invite to get the key again; there's no key backup/recovery.
- **Invite is a bearer secret** — anyone with an unexpired invite can join and
  decrypt; removing a member doesn't rotate the key. Use short-lived / one-time
  invites.
- **Unsigned installer** — Windows SmartScreen warns on first install.
- **Whole-file in-memory crypto** — very large files are encrypted/decrypted in
  memory.

---

## License

[MIT](LICENSE) © Sohaib Irfan
