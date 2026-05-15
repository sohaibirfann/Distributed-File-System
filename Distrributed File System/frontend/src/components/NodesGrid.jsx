import { useEffect, useState } from "react";
import NodeCard from "./NodeCard";

// Map your nodes here
const NODE_MAP = [
  { name: "user1", url: "http://localhost:7001" },
  { name: "user2", url: "http://localhost:7002" },
  { name: "user3", url: "http://localhost:7003" },
];

export default function NodesGrid({ refresh }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchNodes();

    // optional auto refresh every 5s
    const interval = setInterval(fetchNodes, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function fetchNodes() {
    try {
      const results = await Promise.all(
        NODE_MAP.map(async (node) => {
          try {
            const res = await fetch(`${node.url}/stats`);

            if (!res.ok) throw new Error();

            const data = await res.json();

            return {
              name: node.name,
              status: "Online",
              chunks: data.chunks,
              replication: "Healthy",
            };
          } catch (error) {
            return {
              name: node.name,
              status: "Offline",
              chunks: 0,
              replication: "Down",
            };
          }
        }),
      );

      setUsers(results);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">Distributed Storage Nodes</h2>

          <p className="text-slate-400 mt-2">Active replicated storage peers</p>
        </div>

        <span className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm">
          {users.filter((u) => u.status === "Online").length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {users.map((user, index) => (
          <NodeCard key={index} user={user} />
        ))}
      </div>
    </div>
  );
}
