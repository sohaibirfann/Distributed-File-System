import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileText } from "lucide-react";

export default function FileTable({ refresh }) {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFiles();
  }, [refresh]);

  async function fetchFiles() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/files"
      );

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

      await fetch(
        `http://localhost:5000/api/merge/${filename}`,
        {
          method: "POST",
        }
      );

      window.open(
        `http://localhost:5000/api/download/${filename}`
      );

      toast.success("Download started", {
        id: "download",
      });
    } catch (error) {
      console.error(error);

      toast.error("Download failed", {
        id: "download",
      });
    }
  }

  const filteredFiles = files.filter((file) =>
    file.filename
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function getFileType(filename) {
    return (
      filename.split(".").pop()?.toUpperCase() ||
      "FILE"
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">
            Shared Files
          </h2>

          <p className="text-slate-400 mt-1 text-sm">
            Distributed and replicated files
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="
              w-full
              bg-slate-800
              border border-slate-700
              rounded-2xl
              px-4
              py-3
              pr-12
              outline-none
              focus:border-blue-500
              transition
            "
          />

          {search && (
            <button
              onClick={() =>
                setSearch("")
              }
              className="
                absolute
                right-4
                top-1/2
                -translate-y-1/2
                text-slate-400
                hover:text-white
                transition
                text-xl
              "
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="text-left py-4">
                File
              </th>

              <th className="hidden md:table-cell text-left py-4">
                Type
              </th>

              <th className="text-left py-4">
                Chunks
              </th>

              <th className="text-left py-4">
                Size
              </th>

              <th className="hidden lg:table-cell text-left py-4">
                Status
              </th>

              <th className="text-left py-4">
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
                    text-center
                    py-12
                    text-slate-500
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
                    border-b
                    border-slate-800
                    hover:bg-slate-800/30
                    transition
                  "
                >
                  {/* FILE NAME */}
                  <td className="py-5">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="
                        w-10
                        h-10
                        rounded-xl
                        bg-slate-800
                        border border-slate-700
                        flex
                        items-center
                        justify-center
                        shrink-0
                      ">
                        <FileText
                          size={18}
                          className="text-blue-400"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="
                          font-semibold
                          text-white
                          tracking-wide
                          text-[15px]
                          truncate
                        ">
                          {file.filename}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* FILE TYPE */}
                  <td className="hidden md:table-cell">
                    <span className="
                      bg-purple-500/10
                      text-purple-400
                      border border-purple-500/20
                      px-3
                      py-1
                      rounded-xl
                      text-sm
                    ">
                      {getFileType(
                        file.filename
                      )}
                    </span>
                  </td>

                  {/* CHUNKS */}
                  <td>
                    <span className="
                      bg-blue-500/10
                      text-blue-400
                      px-3
                      py-1
                      rounded-xl
                      text-sm
                      whitespace-nowrap
                    ">
                      {file.chunks} Chunks
                    </span>
                  </td>

                  {/* SIZE */}
                  <td>
                    <span className="
                      bg-orange-500/10
                      text-orange-400
                      border border-orange-500/20
                      px-3
                      py-1
                      rounded-xl
                      text-sm
                      whitespace-nowrap
                    ">
                      {(file.size / 1024).toFixed(
                        2
                      )}{" "}
                      KB
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="hidden lg:table-cell">
                    <span className="
                      bg-emerald-500/20
                      text-emerald-400
                      px-3
                      py-1
                      rounded-xl
                      text-sm
                      whitespace-nowrap
                    ">
                      Distributed
                    </span>
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <button
                      onClick={() =>
                        handleDownload(
                          file.filename
                        )
                      }
                      className="
                        bg-emerald-600
                        hover:bg-emerald-500
                        px-3
                        md:px-5
                        py-2
                        rounded-xl
                        transition
                        text-sm
                        font-medium
                        whitespace-nowrap
                      "
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}