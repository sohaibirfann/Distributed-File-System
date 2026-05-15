export default function NodeCard({ user }) {
  const isOnline = user.status === "Online";

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
      {/* Header */}
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
          <div
            className={`w-3 h-3 rounded-full ${
              isOnline
                ? "bg-emerald-400 animate-pulse"
                : "bg-red-500"
            }`}
          ></div>

          <span
            className={`text-sm ${
              isOnline
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">
            Stored Chunks
          </p>

          <h2 className="text-2xl font-bold mt-2">
            {user.chunks}
          </h2>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">
            Replication
          </p>

          <h2
            className={`text-xl font-bold mt-2 ${
              isOnline
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {isOnline ? "Healthy" : "Down"}
          </h2>
        </div>
      </div>

      {/* Simple Chunk Preview (visual only) */}
      <div>
        <p className="text-slate-400 text-sm mb-3">
          Chunk Preview
        </p>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: Math.min(user.chunks, 6) }).map(
            (_, index) => (
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
                #{index}
              </span>
            )
          )}

          {user.chunks > 6 && (
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
              +{user.chunks - 6} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}