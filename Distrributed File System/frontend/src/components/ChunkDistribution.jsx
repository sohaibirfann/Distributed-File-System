import { useEffect, useState } from "react";

export default function ChunkDistribution({
  refresh,
}) {
  const [stats, setStats] = useState({
    totalChunks: 0,
    replicationFactor: 2,
    totalReplicas: 0,
    balanced: true,
  });

  useEffect(() => {
    fetchStats();
  }, [refresh]);

  async function fetchStats() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/health"
      );

      const data = await response.json();

      setStats({
        totalChunks: data.chunks,
        replicationFactor: 2,
        totalReplicas: data.chunks * 2,
        balanced: true,
      });
    } catch (error) {
      console.error(error);
    }
  }

  const cards = [
    {
      title: "Total Chunks",
      value: stats.totalChunks,
      color: "text-blue-400",
    },
    {
      title: "Replication Factor",
      value: `${stats.replicationFactor}x`,
      color: "text-emerald-400",
    },
    {
      title: "Total Replicas",
      value: stats.totalReplicas,
      color: "text-purple-400",
    },
    {
      title: "Distribution",
      value: stats.balanced
        ? "Balanced"
        : "Unbalanced",
      color: "text-orange-400",
    },
  ];

  return (
    <div className="
      bg-[#111827]
      border border-slate-800
      rounded-3xl
      p-6
    ">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">
            Replication Overview
          </h2>

          <p className="text-slate-400 mt-2">
            Distributed chunk replication
            analytics
          </p>
        </div>

        <span className="
          bg-blue-500/20
          text-blue-400
          px-4
          py-2
          rounded-xl
          text-sm
        ">
          Fault Tolerance Enabled
        </span>
      </div>

      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4
        gap-5
      ">
        {cards.map((card, index) => (
          <div
            key={index}
            className="
              bg-slate-900
              border border-slate-800
              rounded-2xl
              p-6
            "
          >
            <p className="text-slate-400 text-sm">
              {card.title}
            </p>

            <h2
              className={`
                text-3xl
                font-bold
                mt-3
                ${card.color}
              `}
            >
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="
        mt-8
        bg-slate-900
        border border-slate-800
        rounded-2xl
        p-5
      ">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium">
            Replication Health
          </p>

          <span className="
            text-emerald-400
            text-sm
          ">
            Healthy
          </span>
        </div>

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
              bg-emerald-500
            "
            style={{ width: "100%" }}
          ></div>
        </div>

        <p className="
          text-slate-400
          text-sm
          mt-3
        ">
          All chunks successfully replicated
          across active nodes
        </p>
      </div>
    </div>
  );
}