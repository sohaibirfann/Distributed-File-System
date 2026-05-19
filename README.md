# Distributed File System (DFS)

A local-network distributed file storage system that splits files into encrypted chunks and replicates them across multiple peer nodes. Files are reassembled on demand and served through a web interface with an admin dashboard and a public user view.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
  - [Prerequisites](#prerequisites)
  - [Backend](#backend)
  - [Node Server](#node-server)
  - [Frontend](#frontend)
- [Environment Variables](#environment-variables)
- [Running the System](#running-the-system)
- [API Endpoints](#api-endpoints)
- [Key Concepts](#key-concepts)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)

---

## Features

- **Chunked file distribution** — files are split into 4 KB chunks and distributed across connected storage nodes with 2-replica redundancy
- **AES-256-GCM encryption** — every chunk is encrypted before leaving the backend; nodes store only ciphertext
- **Download cache** — assembled files are cached in a shared folder (200 MB LRU limit) so repeated downloads skip reassembly
- **Duplicate upload handling** — re-uploading a file with the same name cleanly removes old chunks from all nodes before distributing the new version
- **Node heartbeat system** — nodes send a heartbeat every 15 seconds; the backend automatically deregisters any node silent for more than 60 seconds
- **Real-time latency monitoring** — the backend pings each node on every status poll and reports live latency
- **Live activity log** — all system events streamed to the UI via Socket.io with log export
- **Admin dashboard** with four tabs: Overview, Files, Nodes, Logs
- **File table** with search, column sorting, file type badges, and relative upload timestamps
- **File preview** — line-numbered text preview and image preview (inline, no download required)
- **Drag & drop upload** with real XHR progress bar
- **500 MB file size limit** enforced on both client and server
- **Dark / light theme**

---

## How It Works

### Upload
1. The file is received by the backend via multipart upload and written to a temporary location.
2. `coordinator.js` reads the file, splits it into 4 KB chunks, and generates a SHA-256 hash for each chunk.
3. Each chunk is encrypted with AES-256-GCM (unique IV per chunk).
4. Chunks are distributed round-robin across connected nodes with 2 replicas per chunk — chunk `n` goes to nodes `n % total` and `(n+1) % total`.
5. Chunk metadata (chunk ID, hash, size, node assignments) plus the upload timestamp are saved to `metadata.json`.

### Download
1. The backend checks the shared cache folder first. On a cache hit, the file is served directly and its last-accessed time is refreshed for LRU tracking.
2. On a cache miss, the backend reads `metadata.json`, fetches each encrypted chunk from the assigned nodes, decrypts them, and concatenates the buffers.
3. The assembled file is written to the cache (evicting oldest files if the 200 MB limit would be exceeded) and sent to the client.

### Node Registration
- When a node server starts, it registers its name and URL with the backend (`POST /api/register-node`).
- It then sends a heartbeat every 15 seconds (`POST /api/heartbeat`).
- The backend runs a cleanup interval every 30 seconds and removes any node not heard from in over 60 seconds.

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| Node.js + Express 5 | HTTP server and routing |
| Socket.io | Real-time log streaming to the frontend |
| multer | Multipart file upload handling |
| axios | HTTP requests from coordinator to node servers |
| dotenv | Environment variable loading |
| crypto (built-in) | AES-256-GCM encryption, SHA-256 chunk hashing |

### Node Server
| Package | Purpose |
|---|---|
| Node.js + Express | Lightweight HTTP server |
| cors | Cross-origin request handling |
| axios | Registration and heartbeat requests to backend |
| dotenv | Environment variable loading |

### Frontend
| Package | Purpose |
|---|---|
| React 19 + Vite 8 | UI framework and build tool |
| Tailwind CSS v4 | Utility-first styling |
| React Router v7 | Client-side routing |
| Socket.io client | Real-time log subscription |
| lucide-react | Icons |
| react-hot-toast | Toast notifications |

---

## Project Structure

```
Distributed File System/
├── backend/
│   ├── controllers/
│   │   ├── fileController.js     # Upload, download, delete, cache logic
│   │   └── healthController.js   # Health stats endpoint
│   ├── middleware/
│   │   └── upload.js             # Multer config (500 MB limit, shared folder destination)
│   ├── routes/
│   │   ├── fileRoutes.js         # /api/files/* routes + request logging
│   │   └── healthRoutes.js       # /api/health route
│   ├── app.js                    # Express + Socket.io server, node registry, heartbeat cleanup
│   ├── coordinator.js            # Chunking, encryption, and chunk distribution logic
│   ├── nodeServer.js             # Standalone node storage server
│   ├── .env                      # Encryption key (git-ignored)
│   ├── .env.example              # Template for .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileTable.jsx     # File list with sort, search, preview, delete
│   │   │   ├── LogsPanel.jsx     # Live log stream with export
│   │   │   ├── NodesGrid.jsx     # Node status cards with latency
│   │   │   └── UploadPanel.jsx   # Drag & drop upload with progress bar
│   │   ├── context/
│   │   │   ├── NotificationContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/
│   │   │   └── useApiStatus.js   # Backend connectivity indicator
│   │   ├── pages/
│   │   │   ├── Admin.jsx         # Admin dashboard (Overview, Files, Nodes, Logs tabs)
│   │   │   ├── Login.jsx         # Landing / login page
│   │   │   └── User.jsx          # Public file browser (download only)
│   │   └── main.jsx
│   ├── .env                      # VITE_API_URL (git-ignored)
│   └── package.json
```

---

## Setup Instructions

### Prerequisites

- Node.js v18 or later
- npm
- All machines must be on the same local network

---

### Backend

1. **Navigate to the backend folder**
   ```bash
   cd "Distributed File System/backend"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create the environment file**

   Copy the example file:
   ```bash
   cp .env.example .env
   ```

   Generate a 32-byte encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Paste the output into `.env`:
   ```
   ENCRYPTION_KEY=your_64_char_hex_key_here
   ```

   Keep this key safe. If it is lost, all stored files become unrecoverable.

4. **Start the backend**
   ```bash
   node app.js
   ```

   The server starts on port **5000**. You should see:
   ```
   Backend running on port 5000
   ```

---

### Node Server

Each machine that will act as a storage node only needs three files:

```
nodeServer.js
package.json
node_modules/   (after npm install)
```

1. **Copy `nodeServer.js` and `package.json` to the node machine**

   The node server requires four dependencies: `express`, `cors`, `axios`, `dotenv`. You can use the backend `package.json` as-is or create a minimal one:
   ```json
   {
     "dependencies": {
       "express": "^5.1.0",
       "cors": "^2.8.5",
       "axios": "^1.16.1",
       "dotenv": "^16.0.0"
     }
   }
   ```

2. **Install dependencies on the node machine**
   ```bash
   npm install
   ```

3. **Create the environment file**

   Create a `.env` file in the same folder as `nodeServer.js`:
   ```
   BACKEND_URL=http://<backend-machine-ip>:5000
   ```

   Replace `<backend-machine-ip>` with the local IP of the machine running the backend. On Windows, find it with `ipconfig`.

4. **Start the node server**
   ```bash
   node nodeServer.js <username> <port>
   ```

   Examples:
   ```bash
   node nodeServer.js user1 7001
   node nodeServer.js user2 7002
   ```

   - `username` — a unique name for this node (used as the storage folder name and displayed in the dashboard)
   - `port` — any available port

   On startup the node will:
   - Create a `node_storage/<username>/` folder automatically
   - Register itself with the backend
   - Begin sending heartbeats every 15 seconds

   You can run multiple nodes on the same machine using different usernames and ports.

---

### Frontend

1. **Navigate to the frontend folder**
   ```bash
   cd "Distributed File System/frontend"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create the environment file**

   Create `frontend/.env`:
   ```
   VITE_API_URL=http://<backend-machine-ip>:5000
   ```

   Replace `<backend-machine-ip>` with the local IP of the machine running the backend. On Windows, find it with `ipconfig`.

4. **Start the development server**
   ```bash
   npm run dev
   ```

   Or build for production:
   ```bash
   npm run build
   npm run preview
   ```

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Description | Example |
|---|---|---|
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes). Used for AES-256-GCM chunk encryption. | `5832bbc4b945...` |

The backend will refuse to start with a missing or malformed key.

### Node Server — `.env` (alongside `nodeServer.js`)

| Variable | Description | Example |
|---|---|---|
| `BACKEND_URL` | Full URL of the backend server that this node should register with. | `http://192.168.1.10:5000` |

### Frontend — `frontend/.env`

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Full URL of the backend server | `http://192.168.1.10:5000` |

---

## Running the System

Minimum setup to get files uploading and downloading:

1. Start the backend on one machine
2. Start at least one node server (on any machine on the network)
3. Start the frontend
4. Open the frontend in a browser, go to **Admin** (password: `admin`)
5. Upload a file — it will be chunked, encrypted, and distributed to connected nodes

The system works with one node but there is no redundancy until there are at least two nodes (each chunk needs two replicas).

---

## API Endpoints

### Backend (`http://localhost:5000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Server status check |
| `GET` | `/api/health` | Total files, chunks, and online node count |
| `GET` | `/api/nodes` | All registered nodes with status, latency (ms), and chunk count |
| `POST` | `/api/register-node` | Register a new node `{ name, url }` |
| `POST` | `/api/heartbeat` | Node heartbeat `{ name }` |
| `POST` | `/api/files/upload` | Upload a file (multipart/form-data, field: `file`, max 500 MB) |
| `GET` | `/api/files/` | List all files with size, chunk count, and upload timestamp |
| `GET` | `/api/files/download/:filename` | Download a file (served from cache or assembled from nodes) |
| `DELETE` | `/api/files/delete/:filename` | Delete a file and remove all its chunks from every node |

### Node Server (`http://<node-ip>:<port>`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/store-chunk` | Store an encrypted chunk `{ filename, chunkId, data }` |
| `GET` | `/get-chunk` | Retrieve a chunk `?filename=&chunkId=` |
| `GET` | `/stats` | Returns `{ user, chunks }` — count of stored chunks |
| `POST` | `/delete-chunk` | Delete a specific chunk `{ filename, chunkId }` |

---

## Key Concepts

### Chunking
Files are split into **4 KB chunks**. Each chunk gets a SHA-256 hash stored in metadata for integrity identification.

### Replication
Each chunk is stored on **2 nodes**. The first replica goes to node `chunkId % nodeCount`, the second to `(chunkId + 1) % nodeCount`. This means any single node can go offline and all files remain fully recoverable.

### Encryption
Chunks are encrypted with **AES-256-GCM** before being sent to nodes. The encrypted payload is structured as:

```
[ IV (12 bytes) ][ Auth Tag (16 bytes) ][ Ciphertext ]
```

The auth tag ensures integrity — a tampered chunk will fail decryption. The key never leaves the backend machine.

### LRU Download Cache
Assembled files are written to a `shared/` folder on the backend. On a cache hit the file is served directly. The folder is capped at **200 MB** — when a new file would exceed the limit, the least recently accessed files are deleted first to make room.

### Heartbeat and Node Deregistration
Nodes send `POST /api/heartbeat` every **15 seconds**. The backend checks every **30 seconds** and removes any node not heard from in over **60 seconds**. Deregistered nodes emit a log event visible in the Logs tab.

---

## Limitations

- **No HTTPS** — all traffic between frontend, backend, and nodes is plain HTTP. Acceptable on a trusted LAN but not suitable for the open internet.
- **File-based metadata** — `metadata.json` is read/written on every operation. Not suitable for high concurrency or large numbers of files.
- **No chunk integrity verification on download** — SHA-256 hashes are stored in metadata but not verified when chunks are reassembled.
- **Single backend** — the backend is a single point of failure. If it goes down, uploads and downloads stop even if all nodes are healthy.
- **Admin authentication** — the admin panel is protected only by a `localStorage` flag. It is not secure against a determined user on the same machine.
- **Fixed replication factor** — always 2 replicas. Cannot be configured without code changes.

---

## Future Improvements

- HTTPS / TLS for all traffic
- Proper authentication with hashed passwords or tokens
- Chunk integrity verification using stored SHA-256 hashes on every download
- Configurable replication factor
- Replace `metadata.json` with a proper database (SQLite or similar)
- File versioning — keep previous versions when a file is re-uploaded
- Configurable chunk size and file size limit
- Backend clustering / failover for high availability
- Upload queue for concurrent multi-file uploads
