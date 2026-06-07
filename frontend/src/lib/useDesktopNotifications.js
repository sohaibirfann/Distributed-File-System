import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getApiUrl } from "./api";

export function useDesktopNotifications(groups, user) {
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
