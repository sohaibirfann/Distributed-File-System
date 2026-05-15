import { useEffect, useState } from "react";
import NodeCard from "./NodeCard";

export default function NodesGrid({ refresh }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchNodes();
  }, [refresh]);

  async function fetchNodes() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/nodes"
      );

      const data = await response.json();

      setUsers(data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">
            Distributed Storage Nodes
          </h2>

          <p className="text-slate-400 mt-2">
            Active replicated storage peers
          </p>
        </div>

        <span className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm">
          {users.length} Active
        </span>
      </div>

      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-3
        gap-6
      ">
        {users.map((user, index) => (
          <NodeCard key={index} user={user} />
        ))}
      </div>
    </div>
  );
}