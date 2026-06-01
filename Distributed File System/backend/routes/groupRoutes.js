const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const {
  createGroup,
  getGroup,
  setGroupReplication,
  renameGroup,
  deleteGroup,
  getUserGroups,
  isMember,
  getMemberRole,
  getGroupMembers,
  addMember,
  removeMember,
  createInvite,
  getValidInvite,
  revokeInvite,
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
  const group = createGroup(name, req.user.id, req.body.replication);
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

  addMember(invite.group_id, req.user.id);
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

// PATCH /api/groups/:id — rename the group (owner only)
router.patch("/:id", requireMember, requireOwner, (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  renameGroup(req.params.id, name);
  res.json(getGroup(req.params.id));
});

// DELETE /api/groups/:id — delete the group (owner only). Cascades members,
// invites and file metadata. NB: encrypted chunks already pushed to member
// nodes become orphaned — GC of those is deferred (see PLAN.md).
router.delete("/:id", requireMember, requireOwner, (req, res) => {
  deleteGroup(req.params.id);
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

// POST /api/groups/:id/invites — mint an invite code (members only)
router.post("/:id/invites", requireMember, (req, res) => {
  const expiresAt = req.body.expiresAt ?? null;
  const code = createInvite(req.params.id, req.user.id, expiresAt);
  res.status(201).json({ code });
});

// DELETE /api/groups/:id/invites/:code — revoke an invite (members only)
router.delete("/:id/invites/:code", requireMember, (req, res) => {
  revokeInvite(req.params.code);
  res.json({ success: true });
});

module.exports = router;
