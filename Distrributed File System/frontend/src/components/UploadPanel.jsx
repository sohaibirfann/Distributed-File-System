import { useState } from "react";
import toast from "react-hot-toast";

export default function UploadPanel({
  onUploadSuccess,
}) {
  const [selectedFile, setSelectedFile] =
    useState(null);

  const [progress, setProgress] =
    useState(0);

  const [dragActive, setDragActive] =
    useState(false);

  function handleFile(file) {
    if (!file) return;

    setSelectedFile(file);
    setProgress(0);
  }

  function handleFileChange(event) {
    const file = event.target.files[0];

    handleFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();

    setDragActive(false);

    const file =
      event.dataTransfer.files[0];

    handleFile(file);
  }

  function handleDragOver(event) {
    event.preventDefault();

    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();

    setDragActive(false);
  }

  async function uploadFile() {
    if (!selectedFile) {
      toast.error(
        "Please select a file"
      );

      return;
    }

    try {
      toast.loading("Uploading...", {
        id: "upload",
      });

      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response = await fetch(
        "http://localhost:5000/api/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          "Upload failed"
        );
      }

      let value = 0;

      const interval = setInterval(() => {
        value += 10;

        setProgress(value);

        if (value >= 100) {
          clearInterval(interval);

          toast.success(
            "File uploaded successfully",
            {
              id: "upload",
            }
          );

          if (onUploadSuccess) {
            onUploadSuccess();
          }

          setSelectedFile(null);
          setProgress(0);
        }
      }, 120);
    } catch (error) {
      console.error(error);

      toast.error("Upload failed", {
        id: "upload",
      });
    }
  }

  return (
    <div className="
      bg-[#111827]
      border border-slate-800
      rounded-3xl
      p-6
    ">
      <h2 className="text-2xl font-semibold mb-5">
        Upload File
      </h2>

      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2
          border-dashed
          rounded-3xl
          p-14
          text-center
          transition-all
          duration-300
          cursor-pointer
          block

          ${
            dragActive
              ? `
                border-blue-500
                bg-blue-500/10
                scale-[1.01]
              `
              : `
                border-slate-700
                hover:border-blue-500
                bg-slate-950/40
              `
          }
        `}
      >
        <input
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="space-y-4">
          <div className="text-6xl">
            📂
          </div>

          <p className="text-2xl font-medium">
            Drag & Drop File
          </p>

          <p className="text-slate-400">
            or click to browse files
          </p>

          {selectedFile && (
            <div className="
              mt-6
              bg-slate-900
              border border-slate-700
              rounded-2xl
              p-4
              text-left
              relative
            ">
              {/* REMOVE BUTTON */}
              <button
                onClick={(e) => {
                  e.preventDefault();

                  setSelectedFile(null);
                  setProgress(0);
                }}
                className="
                  absolute
                  top-3
                  right-3
                  w-8
                  h-8
                  rounded-lg
                  bg-slate-800
                  hover:bg-red-500/20
                  text-slate-400
                  hover:text-red-400
                  transition
                  flex
                  items-center
                  justify-center
                  text-lg
                "
              >
                ×
              </button>

              <p className="
                font-medium
                text-lg
                truncate
                pr-10
              ">
                {selectedFile.name}
              </p>

              <p className="
                text-slate-400
                text-sm
                mt-1
              ">
                {(
                  selectedFile.size /
                  1024
                ).toFixed(2)}{" "}
                KB
              </p>

              <div className="mt-4">
                <div className="
                  w-full
                  h-3
                  bg-slate-800
                  rounded-full
                  overflow-hidden
                ">
                  <div
                    className="
                      h-full
                      bg-blue-500
                      transition-all
                      duration-300
                    "
                    style={{
                      width: `${progress}%`,
                    }}
                  ></div>
                </div>

                <p className="
                  text-sm
                  text-slate-400
                  mt-2
                ">
                  Upload Progress:{" "}
                  {progress}%
                </p>
              </div>
            </div>
          )}
        </div>
      </label>

      <button
        onClick={uploadFile}
        className="
          mt-5
          w-full
          bg-blue-600
          hover:bg-blue-500
          py-3
          rounded-2xl
          transition
          font-medium
        "
      >
        Upload To Distributed Network
      </button>
    </div>
  );
}