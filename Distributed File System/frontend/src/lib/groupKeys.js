// Per-group encryption keys live only on this device (localStorage). They are
// shared with new members by being embedded in the invite string after a '#',
// which (like E2E share links) is never transmitted to the coordinator.

import { generateGroupKey, exportKeyB64, importKeyB64 } from "./crypto";

const PREFIX = "dfs_gk_";

export function storeKeyB64(groupId, keyB64) {
  localStorage.setItem(PREFIX + groupId, keyB64);
}

export function getKeyB64(groupId) {
  return localStorage.getItem(PREFIX + groupId);
}

export function hasKey(groupId) {
  return !!getKeyB64(groupId);
}

// Returns the group's CryptoKey, or null if this device doesn't hold it.
export async function loadKey(groupId) {
  const b64 = getKeyB64(groupId);
  return b64 ? importKeyB64(b64) : null;
}

// Generates a fresh key for a new group and persists it locally.
export async function createKeyForGroup(groupId) {
  const key  = await generateGroupKey();
  const b64  = await exportKeyB64(key);
  storeKeyB64(groupId, b64);
  return b64;
}

// ── Invite strings: "<joinCode>#<keyB64>" ──────────────────────────────────────
export function buildInvite(joinCode, keyB64) {
  return `${joinCode}#${keyB64}`;
}

export function parseInvite(str) {
  const trimmed = (str || "").trim();
  const hash    = trimmed.indexOf("#");
  if (hash === -1) return { joinCode: trimmed, keyB64: null };
  return { joinCode: trimmed.slice(0, hash), keyB64: trimmed.slice(hash + 1) || null };
}
