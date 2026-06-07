# DFS — Distributed File System

**🌐 Landing page:** [https://sohaibirfann.github.io/dfs/](https://sohaibirfann.github.io/dfs/)

A private, invite-only desktop app for sharing files inside a small group, where
every file is **end-to-end encrypted on your device** and stored **across the
group members' own machines** instead of a company's cloud.

> Mental model: *"WhatsApp groups, but for file storage."* One person in the group
> runs a small coordinator on the local network; everyone installs the app, joins
> with an invite, and files live distributed across just those members.

## How it works

1. **Encrypt** — a file is encrypted on your device (AES-256-GCM) with the group's
   key, then split into chunks. Plaintext never leaves the device.
2. **Distribute** — encrypted chunks are spread across the group's machines with
   configurable replication, so a file survives members going offline.
3. **Access** — any member fetches the chunks and decrypts on-device with the
   shared group key.

The **coordinator** is a lightweight server one group member runs — a phonebook +
traffic controller that tracks groups/members, who's online, and which encrypted
chunk lives where. It holds **no files and no keys**; group keys live only on
members' devices, delivered through a group's invite. It only ever handles
ciphertext.

> Scope: this is **LAN / self-hosted** — the group runs on one local network (or a
> coordinator the group exposes themselves). There's no central service to sign up
> for and nothing the developer hosts.

## For your group — getting started

You need **one** machine to act as the host (runs the coordinator); everyone else
just installs the app.

**Host (one person):**
1. Run the coordinator — easiest is Docker or Node from this repo
   (see [backend/DEPLOY.md](backend/DEPLOY.md)). It prints its address, e.g.
   `http://192.168.1.50:5000`.
2. Allow it through the firewall — run `backend/open-firewall.ps1` as Administrator
   (opens the coordinator + storage-node ports on your local network).

**Everyone (including the host):**
3. Install the app (`DFS Setup.exe`) and open it.
4. On the first screen, enter the **host's address** (`http://192.168.1.50:5000`).
   The dot in the title bar turns green when connected.
5. Sign up. The host creates a group and shares an **invite**; others **Join with
   code**.
6. In **Settings → Storage**, turn on **Contribute** on the machines that should
   store the group's files.
7. Upload a file — it's encrypted on your device and distributed to the group.

> Note: the installer is **unsigned**, so Windows SmartScreen shows a warning on
> first install — click **More info → Run anyway**.

## Security model

- **AES-256-GCM**, client-side, before anything is uploaded.
- **Keys live only on devices**, shared through a group's invite — never sent to or
  stored on a server.
- **Zero-knowledge coordinator** — metadata only (groups, presence, chunk map).
- **Group isolation** — two groups can't see or decrypt each other's data.

## Repo layout

| Path        | What it is |
|-------------|-----------|
| `backend/`  | The coordinator (Express + SQLite + Socket.io) and a standalone storage-node server (`nodeServer.js`) for dev/headless use. |
| `frontend/` | The React + Vite app (UI), bundled into the desktop client. |
| `desktop/`  | The Electron shell — frameless window, settings, embedded storage node, packaging + auto-update. |
| `spike/`    | WebRTC signaling/peer experiments (not used by the app). |

## Develop

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

## Build & release

- **Package the desktop app:** `cd desktop && npm install && npm run dist` →
  `desktop/release/DFS Setup <version>.exe`. (On Windows, enable Developer Mode so
  the build's signing-tool extraction succeeds.)
- **Ship updates:** the app auto-updates from GitHub Releases — see
  [desktop/RELEASING.md](desktop/RELEASING.md).
- **Host the coordinator:** [backend/DEPLOY.md](backend/DEPLOY.md).
