import { createContext, useContext, useCallback } from "react";
import { useAuth }   from "./AuthContext";
import { useNotify } from "./NotificationContext";
import { useTransfers } from "./TransferContext";
import { loadKey } from "../lib/groupKeys";
import { encryptBytes, bytesToB64url } from "../lib/crypto";
import { makeThumbnailBlob } from "../lib/thumbnail";
import { getApiUrl } from "../lib/api";

const API = getApiUrl();
const MAX_SIZE = 500 * 1024 * 1024;

const UploadContext = createContext(null);

export function useUploads() {
  return useContext(UploadContext);
}

export function UploadProvider({ children }) {
  const { token } = useAuth();
  const notify    = useNotify();
  const transfers = useTransfers();

  const uploadOne = useCallback(async (file, groupId, key) => {
    const tid = transfers.start(file.name, "upload");
    try {
      if (file.size > MAX_SIZE) throw new Error("Too large (max 500 MB)");

      const cipher = await encryptBytes(key, await file.arrayBuffer());
      const form = new FormData();
      form.append("file", new Blob([cipher], { type: "application/octet-stream" }), file.name);

      if (file.type.startsWith("image/")) {
        try {
          const tb = await makeThumbnailBlob(file);
          if (tb) form.append("thumb", bytesToB64url(await encryptBytes(key, await tb.arrayBuffer())));
        } catch { /* a missing thumbnail just falls back to the type icon */ }
      }

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/api/groups/${groupId}/files/upload`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) transfers.update(tid, { progress: Math.round((e.loaded / e.total) * 100) });
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else { try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); } catch { reject(new Error("Upload failed")); } }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(form);
      });

      transfers.finish(tid, "done");
      return true;
    } catch {
      transfers.finish(tid, "error");
      return false;
    }
  }, [token, transfers]);

  const startUploads = useCallback(async (groupId, files) => {
    if (!files?.length) return;
    const key = await loadKey(groupId);
    if (!key) { notify.error("This device doesn't hold this group's key"); return; }

    let ok = 0, fail = 0;
    for (const file of files) (await uploadOne(file, groupId, key)) ? ok++ : fail++;

    if (ok && fail)      notify.error(`${ok} uploaded, ${fail} failed`);
    else if (fail)       notify.error(`Upload failed`);
    else                 notify.success(`Uploaded ${ok} file${ok !== 1 ? "s" : ""}`);
  }, [uploadOne, notify]);

  return (
    <UploadContext.Provider value={{ startUploads }}>
      {children}
    </UploadContext.Provider>
  );
}
