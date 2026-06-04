import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }        from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TitleProvider }         from "./context/TitleContext";
import { TransferProvider }       from "./context/TransferContext";
import Login      from "./pages/Login";
import AppShell   from "./components/AppShell";
import GroupsHome from "./pages/GroupsHome";
import GroupView  from "./pages/GroupView";
import Settings   from "./pages/Settings";
import CoordinatorSetup from "./pages/CoordinatorSetup";
import TitleBar   from "./components/TitleBar";
import { isDesktop } from "./lib/platform";
import { hasCoordinator } from "./lib/api";

// DFS is a desktop app; the marketing landing lives in its own repo. In the
// browser (dev) the same routes load straight into login → groups.
function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <TitleProvider>
          <TransferProvider>
          <div className="flex flex-col h-screen">
            {isDesktop() && <TitleBar />}
            <div className="flex-1 min-h-0 overflow-y-auto">
          {isDesktop() && !hasCoordinator() ? <CoordinatorSetup /> : (
          <Routes>
            <Route path="/"       element={<Navigate to="/login" replace />} />
            <Route path="/login"  element={<Login />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/groups"     element={<GroupsHome />} />
              <Route path="/groups/:id" element={<GroupView />} />
              <Route path="/settings"   element={<Settings />} />
            </Route>
            <Route path="/admin"      element={<Navigate to="/groups" replace />} />
            <Route path="/user"       element={<Navigate to="/groups" replace />} />
            <Route path="*"       element={<Navigate to="/login" replace />} />
          </Routes>
          )}
            </div>
          </div>
          </TransferProvider>
          </TitleProvider>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
