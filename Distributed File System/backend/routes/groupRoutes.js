const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const {
  createGroup,
  getGroup,
  getUserGroups,
  isMember,
  getGroupMembers,
  addMember,
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

// POST /api/groups — create a group (creator becomes owner)
router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const group = createGroup(name, req.user.id);
  res.status(201).json(group);
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

// GET /api/groups/:id — group detail + member list (members only)
router.get("/:id", requireMember, (req, res) => {
  res.json({ ...getGroup(req.params.id), members: getGroupMembers(req.params.id) });
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
