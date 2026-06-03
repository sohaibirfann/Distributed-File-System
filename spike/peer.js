// A spike peer. Run two of them ("send" and "recv") plus the signaling server.
// They establish a DIRECT WebRTC data channel via STUN hole-punching and transfer
// a simulated 512 KB chunk peer-to-peer, verifying SHA-256 integrity on arrival.
//
//   Terminal 1:  npm run signal
//   Terminal 2:  npm run recv
//   Terminal 3:  npm run send
//
// Success = "[recv] integrity: PASS" and the data channel reaching "connected"
// without the signaling server ever touching the chunk bytes.

const nodeDataChannel = require("node-datachannel");
const { io }          = require("socket.io-client");
const crypto          = require("crypto");

const ROLE = process.argv[2];
if (ROLE !== "send" && ROLE !== "recv") {
  console.error("usage: node peer.js <send|recv>");
  process.exit(1);
}

const SIGNAL_URL = process.env.SIGNAL_URL || "http://localhost:9000";
const FRAME_SIZE = 16 * 1024;   // 16 KB — portable WebRTC data-channel message size
const CHUNK_SIZE = 512 * 1024;  // simulate a real 512 KB chunk

const socket = io(SIGNAL_URL);

const peer = new nodeDataChannel.PeerConnection(`spike-${ROLE}`, {
  iceServers: ["stun:stun.l.google.com:19302"],
});

// ── Relay our half of the handshake out to the other peer ──────────────────────
peer.onLocalDescription((sdp, type) => {
  socket.emit("signal", { kind: "description", sdp, type });
});
peer.onLocalCandidate((candidate, mid) => {
  socket.emit("signal", { kind: "candidate", candidate, mid });
});
peer.onStateChange((state) => console.log(`[${ROLE}] connection state: ${state}`));
peer.onGatheringStateChange((s) => console.log(`[${ROLE}] ice gathering: ${s}`));

// ── Apply the other peer's half of the handshake ───────────────────────────────
// Role guard: a sender only expects an "answer", a receiver only an "offer".
// This prevents cross-talk crashes if a stray signal arrives.
socket.on("signal", (data) => {
  if (data.kind === "description") {
    const want = ROLE === "send" ? "answer" : "offer";
    if (data.type !== want) {
      console.log(`[${ROLE}] ignoring unexpected ${data.type} (wanted ${want})`);
      return;
    }
    peer.setRemoteDescription(data.sdp, data.type);
  } else if (data.kind === "candidate") {
    peer.addRemoteCandidate(data.candidate, data.mid);
  }
});

// ── Sender: create the channel once both peers are present ─────────────────────
if (ROLE === "send") {
  let dc = null;
  socket.on("ready", () => {
    if (dc) return;
    console.log("[send] room ready — creating data channel");
    dc = peer.createDataChannel("chunks");
    dc.onOpen(() => {
      console.log("[send] data channel OPEN — sending chunk");
      sendChunk(dc);
    });
    dc.onClosed(() => console.log("[send] data channel closed"));
  });
}

// ── Receiver: wait for the channel, reassemble, verify ─────────────────────────
if (ROLE === "recv") {
  peer.onDataChannel((dc) => {
    console.log(`[recv] data channel received: ${dc.getLabel()}`);
    const frames = [];
    const started = Date.now();

    dc.onMessage((msg) => {
      if (typeof msg === "string" && msg.startsWith("END:")) {
        const expected = msg.slice(4);
        const full     = Buffer.concat(frames);
        const got      = crypto.createHash("sha256").update(full).digest("hex");
        const ok       = got === expected;
        const ms       = Date.now() - started;
        console.log(`[recv] received ${full.length} bytes in ${frames.length} frames (${ms} ms)`);
        console.log(`[recv] integrity: ${ok ? "PASS ✅" : "FAIL ❌"}  got ${got.slice(0, 12)}… expected ${expected.slice(0, 12)}…`);
        cleanupAndExit(ok ? 0 : 1);
      } else {
        frames.push(Buffer.from(msg));
      }
    });
  });
}

function sendChunk(dc) {
  const chunk = crypto.randomBytes(CHUNK_SIZE);
  const hash  = crypto.createHash("sha256").update(chunk).digest("hex");

  let frames = 0;
  for (let off = 0; off < chunk.length; off += FRAME_SIZE) {
    dc.sendMessageBinary(chunk.subarray(off, off + FRAME_SIZE));
    frames++;
  }
  dc.sendMessage("END:" + hash);

  console.log(`[send] sent ${chunk.length} bytes in ${frames} frames (hash ${hash.slice(0, 12)}…)`);
  setTimeout(() => cleanupAndExit(0), 2000);
}

function cleanupAndExit(code) {
  try { peer.close(); } catch {}
  try { nodeDataChannel.cleanup(); } catch {}
  socket.close();
  setTimeout(() => process.exit(code), 200);
}
