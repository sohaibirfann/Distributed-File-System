export default function NodeCard({ user }) {
  const previewChunks = user.chunks.slice(0, 6);

  return (
    <div
      className="
        bg-slate-800/70
        backdrop-blur-lg
        border border-slate-700
        rounded-3xl
        p-5
        transition-all
        duration-300
        hover:border-blue-500
        hover:scale-[1.02]
      "
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xl font-semibold">
            {user.name}
          </h3>

          <p className="text-slate-400 text-sm mt-1">
            Distributed Storage Node
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>

          <span className="text-emerald-400 text-sm">
            Online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">
            Stored Chunks
          </p>

          <h2 className="text-2xl font-bold mt-2">
            {user.chunks.length}
          </h2>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">
            Replication
          </p>

          <h2 className="text-emerald-400 text-xl font-bold mt-2">
            Healthy
          </h2>
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-sm mb-3">
          Chunk Preview
        </p>

        <div className="flex flex-wrap gap-2">
          {previewChunks.map((chunk, index) => (
            <span
              key={index}
              className="
                bg-blue-600/20
                border border-blue-500/30
                text-blue-300
                px-3
                py-1
                rounded-lg
                text-sm
              "
            >
              #{chunk}
            </span>
          ))}

          {user.chunks.length > 6 && (
            <span
              className="
                bg-slate-700
                text-slate-300
                px-3
                py-1
                rounded-lg
                text-sm
              "
            >
              +{user.chunks.length - 6} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}