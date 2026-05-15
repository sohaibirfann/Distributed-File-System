import { useEffect, useState } from "react";

export default function Header({
  refresh,
}) {
  const [nodes, setNodes] = useState(0);

  useEffect(() => {
    fetchStats();
  }, [refresh]);

  async function fetchStats() {
    try {
      const response = await fetch(
        "http://localhost:5000/api/health"
      );

      const data = await response.json();

      setNodes(data.usersOnline);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="
      flex
      flex-col
      xl:flex-row
      xl:items-center
      xl:justify-between
      gap-6
    ">
      <div>
        <h1 className="text-5xl font-bold">
          Distributed File Storage System
        </h1>

        <p className="text-slate-400 mt-4 text-lg">
          Secure Chunk-Based
          Distributed Storage with
          Replication and Fault
          Tolerance
        </p>
      </div>

      <div className="
        flex
        flex-wrap
        gap-4
      ">
        <div className="
          bg-blue-500/10
          border border-blue-500/20
          rounded-3xl
          px-6
          py-4
        ">
          <p className="text-slate-400 text-sm">
            Encryption
          </p>

          <h3 className="text-2xl font-bold text-blue-400 mt-1">
            AES-256
          </h3>
        </div>

        <div className="
          bg-emerald-500/10
          border border-emerald-500/20
          rounded-3xl
          px-6
          py-4
        ">
          <p className="text-slate-400 text-sm">
            Replication
          </p>

          <h3 className="text-2xl font-bold text-emerald-400 mt-1">
            Enabled
          </h3>
        </div>

        <div className="
          bg-purple-500/10
          border border-purple-500/20
          rounded-3xl
          px-6
          py-4
        ">
          <p className="text-slate-400 text-sm">
            Storage Nodes
          </p>

          <h3 className="text-2xl font-bold text-purple-400 mt-1">
            {nodes} Active
          </h3>
        </div>
      </div>
    </div>
  );
}