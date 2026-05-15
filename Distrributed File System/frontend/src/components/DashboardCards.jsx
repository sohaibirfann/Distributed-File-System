import { useEffect, useState } from "react";

export default function DashboardCards({
  refresh,
}) {
  const [stats, setStats] = useState({
    files: 0,
    chunks: 0,
    usersOnline: 0,
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

      setStats(data);
    } catch (error) {
      console.error(error);
    }
  }

  const cards = [
    {
      title: "Files",
      value: stats.files,
    },
    {
      title: "Chunks",
      value: stats.chunks,
    },
    {
      title: "Nodes",
      value: stats.usersOnline,
    },
    {
      title: "Encryption",
      value: "AES-256",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="
            bg-slate-900/70
            backdrop-blur-lg
            border border-slate-800
            rounded-3xl
            p-6
            hover:border-blue-500
            transition-all
            duration-300
          "
        >
          <p className="text-slate-400">
            {card.title}
          </p>

          <h2 className="text-3xl font-bold mt-3">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}