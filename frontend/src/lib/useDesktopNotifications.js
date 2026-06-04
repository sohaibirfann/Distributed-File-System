import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getApiUrl } from "./api";

// Surfaces native OS notifications for things that happen in the user's groups
// on other members' machines (a file is added, a member joins). It keeps a
// persistent Socket.io connection to the coordinator and filters the broadcast
// down to the caller's own groups, skipping events the caller caused.
//
// Desktop-only (needs the Electron bridge). The coordinator broadcasts globally
// and we filter client-side — fine at this app's scale; per-group socket rooms
// would be the move if it ever grows large.
export function useDesktopNotifications(groups, user) {
  // Keep the latest groups without re-opening the socket on every change.
  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; });

  useEffect(() => {
    const notify = window.dfsDesktop?.notify;
    if (!notify || !user) return;

    const socket = io(getApiUrl());
    const groupName = (id) => groupsRef.current?.find((g) => String(g.id) === String(id))?.name;

    const relevant = (groupId, byId) => byId !== user.id && !!groupName(groupId);

    const onFileAdded = ({ groupId, filename, byId, byName }) => {
      if (!relevant(groupId, byId)) return;
      notify({ title: `New file in ${groupName(groupId)}`, body: `${byName || "Someone"} added ${filename}` });
    };
    const onMemberJoined = ({ groupId, byId, byName }) => {
      if (!relevant(groupId, byId)) return;
      notify({ title: `${byName || "Someone"} joined ${groupName(groupId)}`, body: "New member in your group" });
    };

    socket.on("file-added", onFileAdded);
    socket.on("member-joined", onMemberJoined);
    return () => {
      socket.off("file-added", onFileAdded);
      socket.off("member-joined", onMemberJoined);
      socket.disconnect();
    };
  }, [user?.id]);
}
