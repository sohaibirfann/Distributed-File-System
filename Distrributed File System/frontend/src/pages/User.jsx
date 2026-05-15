import { useState } from "react";

import Header from "../components/Header";
import DashboardCards from "../components/DashboardCards";
import FileTable from "../components/FileTable";
import NodesGrid from "../components/NodesGrid";
import Footer from "../components/Footer";

export default function User() {
  const [refresh, setRefresh] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Header refresh={refresh} />

        <DashboardCards refresh={refresh} />

        <FileTable refresh={refresh} isAdmin={false} />

        <NodesGrid refresh={refresh} />

        <Footer />
      </div>
    </div>
  );
}