import { useState } from "react";

import Header from "./components/Header";
import DashboardCards from "./components/DashboardCards";
import UploadPanel from "./components/UploadPanel";
import LogsPanel from "./components/LogsPanel";
import FileTable from "./components/FileTable";
import NodesGrid from "./components/NodesGrid";
import ChunkDistribution from "./components/ChunkDistribution";
import Footer from "./components/Footer";

function App() {
  const [refresh, setRefresh] = useState(false);

  function refreshData() {
    setRefresh((prev) => !prev);
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Header refresh={refresh} />

        <DashboardCards refresh={refresh} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UploadPanel refreshData={refreshData} />
          </div>

          <LogsPanel />
        </div>

        <FileTable refresh={refresh} />

        <ChunkDistribution refresh={refresh} />

        <NodesGrid refresh={refresh} />

        <Footer />
      </div>
    </div>
  );
}

export default App;