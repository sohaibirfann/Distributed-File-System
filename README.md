# Distributed File Management System

A distributed file storage system that splits files into chunks, distributes them across multiple nodes, and reconstructs them on demand.

---

## Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [How It Works](#-how-it-works)
- [Setup Instructions](#-setup-instructions)
- [Environment Setup](#-environment-setup)
- [API Endpoints](#-api-endpoints)
- [Key Concepts](#-key-concepts)
- [Limitations](#-limitations)
- [Future Improvements](#-future-improvements)
- [Author](#-author)

---

## Features

- Upload files and split into chunks  
- Replication across multiple storage nodes  
- Download and merge files dynamically  
- Central coordinator for chunk distribution  
- Frontend dashboard  
- Multi-node support across different machines  

---

## Architecture

Frontend (React - Vite)  
↓  
Backend (Node.js + Express)  
↓  
Coordinator (Chunk Distribution)  
↓  
Storage Nodes (user1, user2, user3...)

---

## ⚙️ Tech Stack

- Frontend: React (Vite), Tailwind CSS  
- Backend: Node.js, Express  
- Communication: REST APIs  
- Storage: File system (chunk-based)  
- Realtime Logs: Socket.io  

---

## Project Structure

```
backend/
  controllers/
  routes/
  middleware/
  node_storage/
  coordinator.js
  nodeServer.js
  app.js

frontend/
  src/
    components/
    pages/
```

---

## How It Works

### 1. Upload
- File is uploaded to backend  
- Coordinator splits file into 4KB chunks  
- Chunks are distributed across nodes  

### 2. Storage
- Nodes store chunks locally  
- Metadata tracks chunk locations  

### 3. Download
- Backend fetches chunks from nodes  
- Chunks are merged in order  
- Final file is returned  

---

## Setup Instructions

### 1. Clone

```
git clone <your-repo-url>
cd your-project
```

### 2. Backend

```
cd backend
npm install
node app.js
```

Runs on:
```
http://localhost:5000
```

### 3. Start Nodes

```
node nodeServer.js user1 7001
node nodeServer.js user2 7002
node nodeServer.js user3 7003
```

### 4. Frontend

```
cd frontend
npm install
npm run dev -- --host
```

Open:
```
http://<your-ip>:5173
```

---

## Environment Setup

Create `.env` inside frontend:

```
VITE_API_URL=http://<backend-ip>:5000
```

Example:
```
VITE_API_URL=http://192.168.1.231:5000
```

---

## API Endpoints

### Files
- GET /api/files  
- POST /api/files/upload  
- GET /api/files/download/:filename  
- DELETE /api/files/delete/:filename  

### Nodes
- GET /api/nodes  

---

## Key Concepts

- Chunking (4KB pieces)  
- Replication  
- Fault tolerance  
- Metadata-based tracking  

---

## Future Improvements

- Add database  
- Dynamic node discovery  
- Better UI  
- Docker support  

---
