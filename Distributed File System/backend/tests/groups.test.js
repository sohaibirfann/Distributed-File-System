// Test for the group/invite DB layer. Runs against a throwaway temp DB.
//   npm test   (or: node tests/groups.test.js)
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const TMP = path.join(os.tmpdir(), `dfs-test-${Date.now()}.db`);
process.env.DFS_DB_PATH = TMP;

const db = require("../db");

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else      { failed++; console.log(`  ❌ ${label}`); }
}

try {
  // Seed users
  db.createUser("alice", "hash", "admin");
  db.createUser("bob",   "hash");
  const alice = db.getUserByUsername("alice");
  const bob   = db.getUserByUsername("bob");

  console.log("\nGroups:");
  const g = db.createGroup("Photos", alice.id);
  check("createGroup returns an id", typeof g.id === "string" && g.id.length > 0);
  check("getGroup finds it",         db.getGroup(g.id)?.name === "Photos");
  check("creator is auto-owner",     db.isMember(g.id, alice.id));
  check("non-member is not a member", !db.isMember(g.id, bob.id));

  console.log("\nMembership:");
  db.addMember(g.id, bob.id);
  check("addMember works",           db.isMember(g.id, bob.id));
  const members = db.getGroupMembers(g.id);
  check("two members listed",        members.length === 2);
  check("alice is owner",            members.find((m) => m.username === "alice")?.role === "owner");
  check("bob is member",             members.find((m) => m.username === "bob")?.role === "member");
  check("alice's groups include it", db.getUserGroups(alice.id).some((x) => x.id === g.id));
  check("bob's groups include it",   db.getUserGroups(bob.id).some((x) => x.id === g.id));

  console.log("\nInvites:");
  const code = db.createInvite(g.id, alice.id);
  check("createInvite returns a code", typeof code === "string" && code.length > 0);
  check("valid invite resolves to group", db.getValidInvite(code)?.group_id === g.id);
  db.revokeInvite(code);
  check("revoked invite is invalid",  db.getValidInvite(code) === null);

  const expired = db.createInvite(g.id, alice.id, new Date(Date.now() - 1000).toISOString());
  check("expired invite is invalid",  db.getValidInvite(expired) === null);
  const future  = db.createInvite(g.id, alice.id, new Date(Date.now() + 60000).toISOString());
  check("future-dated invite is valid", db.getValidInvite(future)?.group_id === g.id);

  console.log("\nCascade / isolation:");
  db.deleteGroup(g.id);
  check("deleted group is gone",       db.getGroup(g.id) === null);
  check("membership cascaded away",    db.getUserGroups(alice.id).length === 0);
  check("invites cascaded away",       db.getValidInvite(future) === null);

  console.log(`\n${failed === 0 ? "ALL PASS ✅" : "FAILURES ❌"} — ${passed} passed, ${failed} failed`);
} finally {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(TMP + suffix); } catch {}
  }
}

process.exit(failed === 0 ? 0 : 1);
