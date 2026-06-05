# Deploying the coordinator (Oracle Cloud Always Free)

The coordinator is the only always-on piece (control plane: login, groups,
metadata, signaling). It holds **no file data and no keys**. This runs it free,
24/7, on an Oracle Cloud "Always Free" VM via Docker.

> **Scope note:** a public coordinator gives you a global **control plane** —
> members on any network can sign in, see groups, and share invites. It does
> **not** by itself enable cross-network *file* transfer: chunk transfer still
> uses the embedded node's HTTP endpoints (same-LAN only) until the WebRTC
> transport (Phase 3) lands. Deploying this is the prerequisite that lets us
> build + test that next.

## 1. Create the VM
- Oracle Cloud → Compute → Instances → **Create**.
- Shape: **Ampere A1 (ARM)**, Always Free eligible (generous: up to 4 OCPU / 24 GB).
  The AMD "Micro" shape also works but has only 1 GB RAM.
- Image: **Ubuntu 22.04**.
- Download the SSH key. Note the instance's **public IP**.

## 2. Open port 5000 (two layers — this is the usual gotcha)
Oracle blocks inbound traffic at *both* the cloud firewall and the OS firewall.
- **Cloud:** VCN → the instance's subnet → Security List → **Add Ingress Rule**:
  Source `0.0.0.0/0`, IP Protocol TCP, Destination port `5000`.
- **OS (on the VM, over SSH):**
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
  sudo netfilter-persistent save
  ```

## 3. Install Docker (on the VM)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker   # optional: run docker without sudo
```

## 4. Get the code + set secrets
```bash
git clone https://github.com/sohaibirfann/Distributed-File-System.git
cd Distributed-File-System/backend

# Secrets — generate strong random values. docker compose reads this .env
# for ${VAR} substitution (it is NOT baked into the image).
cat > .env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
NODE_SECRET=$(openssl rand -hex 32)
EOF
```

## 5. Run it
```bash
docker compose up -d --build      # first build compiles better-sqlite3; takes a few min
docker compose logs -f            # watch it boot ("Backend running on port 5000")
```
SQLite metadata persists in the `coordinator-data` volume across restarts/redeploys.

## 6. Verify
```bash
curl http://localhost:5000/api/health           # on the VM
curl http://<PUBLIC_IP>:5000/api/health          # from your machine → {"ok":true,...}
```

## 7. Point the desktop app at it
In the app: **Settings → Connection** (or the first-run setup screen) →
`http://<PUBLIC_IP>:5000`. The connection dot in the title bar should go green.

## Notes
- **HTTP only** for now (raw IP, no cert). Fine for the API + Socket.io. For HTTPS
  later: point a domain at the IP and front it with Caddy (auto Let's Encrypt) or
  Nginx, then use `https://your.domain`.
- **Updating:** `git pull && docker compose up -d --build`.
- The `NODE_SECRET` here must match what each member's app/node uses to register
  (read from `backend/.env` in dev; configured per-install otherwise).
