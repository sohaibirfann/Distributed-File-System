import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileText } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

export default function FileTable({ refresh, isAdmin = false }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFiles();

    const interval = setInterval(fetchFiles, 2000); // refresh every 3s

    return () => clearInterval(interval);
  }, []);

  async function fetchFiles() {
    try {
      const response = await fetch(`${API}/api/files`);

      const data = await response.json();

      setFiles(data);
    } catch (error) {
      console.error(error);

      toast.error("Failed to fetch files");
    }
  }

  async function handleDownload(filename) {
    try {
      toast.loading("Preparing download...", {
        id: "download",
      });

      const response = await fetch(
        `http://localhost:5000/api/files/download/${filename}`,
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();

      // Create temporary link
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      // Cleanup
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download complete", {
        id: "download",
      });
    } catch (error) {
      console.error(error);

      toast.error("Download failed", {
        id: "download",
      });
    }
  }

  async function handlePreview(filename) {
    try {
      toast.loading("Loading preview...", { id: "preview" });

      const response = await fetch(`${API}/api/files/download/${filename}`);

      const text = await response.text();

      setPreviewContent(text);
      setPreviewFile(filename);
      setShowPreview(true);

      toast.success("Preview loaded", { id: "preview" });
    } catch (error) {
      console.error(error);
      toast.error("Preview failed", { id: "preview" });
    }
  }

  async function handleDelete(filename) {
    try {
      // if (!confirm(`Delete ${filename}?`)) return;

      await fetch(`${API}/api/files/delete/${filename}`, {
        method: "DELETE",
      });

      toast.success("File deleted");

      // refresh table
      fetchFiles();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  }

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(search.toLowerCase()),
  );

  function getFileType(filename) {
    return filename.split(".").pop()?.toUpperCase() || "FILE";
  }

  return (
    <div
      className="
        p-4
        bg-slate-900
        border border-slate-800 rounded-3xl
        md:p-6
      "
    >
      <div
        className="
          flex flex-col
          mb-6
          gap-4
          md:flex-row md:items-center md:justify-between
        "
      >
        <div>
          <h2
            className="
              text-2xl font-semibold
            "
          >
            Shared Files
          </h2>

          <p
            className="
              mt-1
              text-slate-400 text-sm
            "
          >
            Distributed and replicated files
          </p>
        </div>

        <div
          className="
            w-full
            relative
            md:w-80
          "
        >
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full
              px-4 py-3 pr-12
              bg-slate-800
              border border-slate-700 rounded-2xl
              outline-none focus:border-blue-500 transition
            "
          />

          {search && (
            <button
              onClick={() => setSearch("")}
              className="
                text-slate-400 text-xl
                absolute right-4 top-1/2 -translate-y-1/2 hover:text-white transition
              "
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div
        className="
          overflow-x-auto
        "
      >
        <table
          className="
            w-full min-w-[700px]
          "
        >
          <thead>
            <tr
              className="
                text-slate-400
                border-b border-slate-800
              "
            >
              <th
                className="
                  py-4
                  text-left
                "
              >
                File
              </th>

              <th
                className="
                  hidden
                  py-4
                  text-left
                  md:table-cell
                "
              >
                Type
              </th>

              {/* <th className="text-left py-4">
                Chunks
              </th> */}

              <th
                className="
                  py-4
                  text-left
                "
              >
                Size
              </th>

              <th
                className="
                  hidden
                  py-4
                  text-left
                  lg:table-cell
                "
              >
                Status
              </th>

              <th
                className="
                  py-4
                  text-left
                "
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredFiles.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="
                    py-12
                    text-center text-slate-500
                  "
                >
                  No files found
                </td>
              </tr>
            ) : (
              filteredFiles.map((file, index) => (
                <tr
                  key={index}
                  className="
                    border-b border-slate-800
                    hover:bg-slate-800/30 transition
                  "
                >
                  {/* FILE NAME */}
                  <td
                    className="
                      py-5
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-[220px]
                        items-center gap-3
                      "
                    >
                      <div
                        className="
                          flex
                          w-10 h-10
                          bg-slate-800
                          rounded-xl border border-slate-700
                          items-center justify-center shrink-0
                        "
                      >
                        <FileText
                          size={18}
                          className="
                            text-blue-400
                          "
                        />
                      </div>

                      <div
                        className="
                          min-w-0
                        "
                      >
                        <p
                          className="
                            font-semibold text-white tracking-wide text-[15px]
                            truncate
                          "
                        >
                          {file.filename}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* FILE TYPE */}
                  <td
                    className="
                      hidden
                      md:table-cell
                    "
                  >
                    <span
                      className="
                        px-3 py-1
                        text-purple-400 text-sm
                        bg-purple-500/10
                        border border-purple-500/20 rounded-xl
                      "
                    >
                      {getFileType(file.filename)}
                    </span>
                  </td>

                  {/* CHUNKS */}
                  <td>
                    <span
                      className="
                        px-3 py-1
                        text-blue-400 text-sm whitespace-nowrap
                        bg-blue-500/10
                        rounded-xl
                      "
                    >
                      {file.chunks} Chunks
                    </span>
                  </td>

                  {/* SIZE */}
                  <td>
                    <span
                      className="
                        px-3 py-1
                        text-orange-400 text-sm whitespace-nowrap
                        bg-orange-500/10
                        border border-orange-500/20 rounded-xl
                      "
                    >
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  </td>

                  {/* STATUS */}
                  <td
                    className="
                      hidden
                      lg:table-cell
                    "
                  >
                    <span
                      className="
                        px-3 py-1
                        text-emerald-400 text-sm whitespace-nowrap
                        bg-emerald-500/20
                        rounded-xl
                      "
                    >
                      Distributed
                    </span>
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <div
                      className="
                        flex
                        items-center gap-2
                      "
                    >
                      <button
                        onClick={() => handleDownload(file.filename)}
                        className="
                          px-3 py-2
                          text-sm font-medium
                          bg-emerald-600
                          rounded-xl
                          hover:bg-emerald-500 transition
                          md:px-5
                        "
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handlePreview(file.filename)}
                        className="
                          px-4 py-2
                          text-blue-400 text-sm
                          bg-blue-500/20
                          rounded-xl
                          hover:bg-blue-500/30 transition
                        "
                      >
                        Preview
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setFileToDelete(file.filename);
                            setShowDeleteModal(true);
                          }}
                          className="
                            px-4 py-2
                            text-red-400 text-sm
                            bg-red-500/20
                            rounded-xl
                            hover:bg-red-500/30 transition
                          "
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showPreview && (
        <div
          className="
            flex z-50
            bg-black/70
            fixed inset-0 items-center justify-center
          "
        >
          <div
            className="
              overflow-hidden flex flex-col
              w-[90%] max-w-3xl max-h-[80vh]
              p-6
              bg-slate-900
              rounded-2xl
            "
          >
            <div
              className="
                flex
                mb-4
                justify-between items-center
              "
            >
              <h2
                className="
                  text-lg font-semibold
                "
              >
                {previewFile}
              </h2>

              <button
                onClick={() => setShowPreview(false)}
                className="
                  text-slate-400 text-xl
                  hover:text-white
                "
              >
                ×
              </button>
            </div>

            <div
              className="
                overflow-y-auto
                p-4
                text-sm whitespace-pre-wrap
                bg-slate-800
                rounded-xl
              "
            >
              {previewContent}
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-2xl w-[90%] max-w-md">
            <h2 className="text-lg font-semibold mb-3">Delete File</h2>

            <p className="text-slate-400 mb-6">
              Are you sure you want to delete{" "}
              <span className="text-white font-semibold">{fileToDelete}</span>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-700 rounded-xl hover:bg-slate-600"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  handleDelete(fileToDelete);
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 bg-red-600 rounded-xl hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
