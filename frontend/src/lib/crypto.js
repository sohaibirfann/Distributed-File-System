// Client-side AES-256-GCM using the browser's Web Crypto API.
// The group key never leaves the device; the coordinator only ever handles the
// ciphertext produced here.

const IV_BYTES = 12; // standard GCM nonce length

// ── base64url <-> bytes ────────────────────────────────────────────────────────
function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Keys ────────────────────────────────────────────────────────────────────
export async function generateGroupKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportKeyB64(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToB64url(new Uint8Array(raw));
}

export async function importKeyB64(b64url) {
  return crypto.subtle.importKey("raw", b64urlToBytes(b64url), "AES-GCM", true, ["encrypt", "decrypt"]);
}

// ── Encrypt / decrypt whole blobs ──────────────────────────────────────────────
// Output layout: [ iv (12 bytes) ][ ciphertext + GCM tag ]
export async function encryptBytes(key, dataBuffer) {
  const iv  = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct  = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dataBuffer);
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), IV_BYTES);
  return out;
}

export async function decryptBytes(key, dataBuffer) {
  const bytes = new Uint8Array(dataBuffer);
  const iv    = bytes.slice(0, IV_BYTES);
  const ct    = bytes.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(plain);
}
