const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { purgeGroupChunks } = require("../controllers/fileController");
const {
  createGroup,
  getGroup,
  setGroupReplication,
  updateGroup,
  deleteGroup,
  getUserGroups,
  isMember,
  getMemberRole,
  getGroupMembers,
  addMember,
  removeMember,
  transferOwnership,
  createInvite,
  getValidInvite,
  consumeInvite,
  revokeInvite,
  listGroupInvites,
} = require("../db");

// Every group route requires a logged-in user (any role — groups are peer-owned,
// not admin-controlled).
router.use(requireAuth);

// Membership guard for routes scoped to a specific group.
function requireMember(req, res, next) {
  if (!isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: "Not a member of this group" });
  }
  next();
}

// Owner guard — for destructive group-level actions (rename, delete, remove member).
function requireOwner(req, res, next) {
  if (getMemberRole(req.params.id, req.user.id) !== "owner") {
    return res.status(403).json({ error: "Only the group owner can do this" });
  }
  next();
}

// POST /api/groups — create a group (creator becomes owner)
router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const group = createGroup(name, req.user.id, req.body.replication, req.body.emoji, req.body.color);
  res.status(201).json(group);
});

// PATCH /api/groups/:id/replication — change the group's replication preset
router.patch("/:id/replication", requireMember, (req, res) => {
  const ok = setGroupReplication(req.params.id, req.body.replication);
  if (!ok) return res.status(400).json({ error: "Invalid replication preset" });
  res.json({ success: true, replication: req.body.replication });
});

// GET /api/groups — list the groups the current user belongs to
router.get("/", (req, res) => {
  res.json(getUserGroups(req.user.id));
});

// POST /api/groups/join — join via an invite code
router.post("/join", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code required" });

  const invite = getValidInvite(code);
  if (!invite) return res.status(404).json({ error: "Invalid or expired invite" });

  // Only count a redemption when it actually adds a new member — re-opening an
  // invite you already used (e.g. to reload the key) shouldn't burn a use.
  const alreadyMember = isMember(invite.group_id, req.user.id);
  addMember(invite.group_id, req.user.id);
  if (!alreadyMember) consumeInvite(code, req.user.id);
  res.json(getGroup(invite.group_id));
});

// GET /api/groups/:id — group detail + member list + caller's role (members only)
router.get("/:id", requireMember, (req, res) => {
  res.json({
    ...getGroup(req.params.id),
    members: getGroupMembers(req.params.id),
    myRole:  getMemberRole(req.params.id, req.user.id),
  });
});

// PATCH /api/groups/:id — edit the group: name (+ optional emoji/color) (owner only)
router.patch("/:id", requireMember, requireOwner, (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  res.json(updateGroup(req.params.id, { name, emoji: req.body.emoji, color: req.body.color }));
});

// DELETE /api/groups/:id — delete the group (owner only). First GCs the group's
// encrypted chunks off member nodes, then cascades members, invites and file
// metadata in the DB.
router.delete("/:id", requireMember, requireOwner, async (req, res) => {
  // Best-effort: wipe the group's encrypted chunks off member nodes before the
  // DB cascade removes the chunk→node map. A node being offline won't block this.
  try { await purgeGroupChunks(req.params.id); }
  catch (e) { console.error("[group delete] chunk GC failed:", e.message); }
  deleteGroup(req.params.id);
  res.json({ success: true });
});

// POST /api/groups/:id/transfer — hand ownership to another member (owner only)
router.post("/:id/transfer", requireMember, requireOwner, (req, res) => {
  const toId = Number(req.body.userId);
  if (!Number.isInteger(toId))      return res.status(400).json({ error: "userId required" });
  if (toId === req.user.id)         return res.status(400).json({ error: "You are already the owner" });
  if (getMemberRole(req.params.id, toId) == null)
    return res.status(404).json({ error: "Not a member of this group" });
  transferOwnership(req.params.id, req.user.id, toId);
  res.json({ success: true });
});

// DELETE /api/groups/:id/members/:userId — leave the group (userId = "me") or,
// for the owner, remove another member.
router.delete("/:id/members/:userId", requireMember, (req, res) => {
  const groupId  = req.params.id;
  const actorId  = req.user.id;
  const targetId = req.params.userId === "me" ? actorId : Number(req.params.userId);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "invalid member" });

  const targetRole = getMemberRole(groupId, targetId);
  if (!targetRole) return res.status(404).json({ error: "Not a member of this group" });

  // Leaving (acting on yourself)
  if (targetId === actorId) {
    if (targetRole === "owner") {
      return res.status(400).json({ error: "The owner can't leave — delete the group or transfer ownership first." });
    }
    removeMember(groupId, actorId);
    return res.json({ success: true });
  }

  // Removing someone else — owner only, and never the owner.
  if (getMemberRole(groupId, actorId) !== "owner") {
    return res.status(403).json({ error: "Only the group owner can remove members" });
  }
  if (targetRole === "owner") {
    return res.status(400).json({ error: "Can't remove the owner" });
  }
  removeMember(groupId, targetId);
  res.json({ success: true });
});

// GET /api/groups/:id/invites — list active (non-revoked) invite codes (members)
router.get("/:id/invites", requireMember, (req, res) => {
  res.json(listGroupInvites(req.params.id));
});

// POST /api/groups/:id/invites — mint an invite code (members only). Optional
// `expiresAt` (ISO string) sets an expiry; omit/null for a non-expiring invite.
router.post("/:id/invites", requireMember, (req, res) => {
  let expiresAt = req.body.expiresAt ?? null;
  if (expiresAt != null) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) return res.status(400).json({ error: "invalid expiresAt" });
    expiresAt = d.toISOString();
  }
  const maxUses = req.body.singleUse ? 1 : null; // single-use → cap at one redemption
  const code = createInvite(req.params.id, req.user.id, expiresAt, maxUses);
  res.status(201).json({ code, expires_at: expiresAt, max_uses: maxUses });
});

// DELETE /api/groups/:id/invites/:code — revoke an invite (members only)
router.delete("/:id/invites/:code", requireMember, (req, res) => {
  revokeInvite(req.params.code);
  res.json({ success: true });
});

module.exports = router;
