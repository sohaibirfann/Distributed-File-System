# WebRTC Transport Spike

Throwaway proof-of-concept for **Phase 2** of the plan. Goal: prove that two
member nodes can open a **direct peer-to-peer WebRTC data channel** (via a tiny
Socket.io signaling server) and transfer a 512 KB chunk with integrity intact —
without the signaling server ever touching the chunk bytes.

If this works, the architecture holds. If P2P transfer from real home networks
turns out to need a relay most of the time, we learn it here, cheaply.

## Run it (local — proves the mechanics)

Three terminals, from `spike/`:

```bash
npm install
npm run signal     # terminal 1 — signaling server on :9000
npm run recv       # terminal 2 — receiver peer
npm run send       # terminal 3 — sender peer
```

**Success looks like:**
- both peers reach connection state `connected`
- `[send] sent 524288 bytes in 32 frames`
- `[recv] integrity: PASS ✅`

## The real test (proves NAT traversal)

Local only proves the wiring. The architecture is truly validated by running
`send` and `recv` on **two different physical networks** (e.g. your machine +
a friend's, or one peer on a phone hotspot), pointing both at a signaling server
they can both reach:

```bash
SIGNAL_URL=http://<signaling-host>:9000 npm run recv
SIGNAL_URL=http://<signaling-host>:9000 npm run send
```

Watch the connection state. If it reaches `connected` across networks, STUN
hole-punching works. If it stalls, that network needs a TURN relay fallback.

## Library

`node-datachannel` (libdatachannel bindings) — actively maintained, runs in Node,
which is where the Electron main process will run this. Chosen over `simple-peer`
(depends on the abandoned `wrtc` package).
