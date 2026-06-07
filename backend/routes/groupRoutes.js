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

router.use(requireAuth);

function requireMember(req, res, next) {
  if (!isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: "Not a member of this group" });
  }
  next();
}

function requireOwner(req, res, next) {
  if (getMemberRole(req.params.id, req.user.id) !== "owner") {
    return res.status(403).json({ error: "Only the group owner can do this" });
  }
  next();
}

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const group = createGroup(name, req.user.id, req.body.replication, req.body.emoji, req.body.color);
  res.status(201).json(group);
});

router.patch("/:id/replication", requireMember, (req, res) => {
  const ok = setGroupReplication(req.params.id, req.body.replication);
  if (!ok) return res.status(400).json({ error: "Invalid replication preset" });
  res.json({ success: true, replication: req.body.replication });
});

router.get("/", (req, res) => {
  res.json(getUserGroups(req.user.id));
});

router.post("/join", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code required" });

  const invite = getValidInvite(code);
  if (!invite) return res.status(404).json({ error: "Invalid or expired invite" });

  const alreadyMember = isMember(invite.group_id, req.user.id);
  addMember(invite.group_id, req.user.id);
  if (!alreadyMember) {
    consumeInvite(code, req.user.id);
    req.app.get("io").emit("member-joined", { groupId: invite.group_id, byId: req.user.id, byName: req.user.username });
  }
  res.json(getGroup(invite.group_id));
});

router.get("/:id", requireMember, (req, res) => {
  res.json({
    ...getGroup(req.params.id),
    members: getGroupMembers(req.params.id),
    myRole:  getMemberRole(req.params.id, req.user.id),
  });
});

router.patch("/:id", requireMember, requireOwner, (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  res.json(updateGroup(req.params.id, { name, emoji: req.body.emoji, color: req.body.color }));
});

router.delete("/:id", requireMember, requireOwner, async (req, res) => {
  try { await purgeGroupChunks(req.params.id); }
  catch (e) { console.error("[group delete] chunk GC failed:", e.message); }
  deleteGroup(req.params.id);
  res.json({ success: true });
});

router.post("/:id/transfer", requireMember, requireOwner, (req, res) => {
  const toId = Number(req.body.userId);
  if (!Number.isInteger(toId))      return res.status(400).json({ error: "userId required" });
  if (toId === req.user.id)         return res.status(400).json({ error: "You are already the owner" });
  if (getMemberRole(req.params.id, toId) == null)
    return res.status(404).json({ error: "Not a member of this group" });
  transferOwnership(req.params.id, req.user.id, toId);
  res.json({ success: true });
});

router.delete("/:id/members/:userId", requireMember, (req, res) => {
  const groupId  = req.params.id;
  const actorId  = req.user.id;
  const targetId = req.params.userId === "me" ? actorId : Number(req.params.userId);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "invalid member" });

  const targetRole = getMemberRole(groupId, targetId);
  if (!targetRole) return res.status(404).json({ error: "Not a member of this group" });

  if (targetId === actorId) {
    if (targetRole === "owner") {
      return res.status(400).json({ error: "The owner can't leave — delete the group or transfer ownership first." });
    }
    removeMember(groupId, actorId);
    return res.json({ success: true });
  }

  if (getMemberRole(groupId, actorId) !== "owner") {
    return res.status(403).json({ error: "Only the group owner can remove members" });
  }
  if (targetRole === "owner") {
    return res.status(400).json({ error: "Can't remove the owner" });
  }
  removeMember(groupId, targetId);
  res.json({ success: true });
});

router.get("/:id/invites", requireMember, (req, res) => {
  res.json(listGroupInvites(req.params.id));
});

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

router.delete("/:id/invites/:code", requireMember, (req, res) => {
  revokeInvite(req.params.code);
  res.json({ success: true });
});

module.exports = router;
