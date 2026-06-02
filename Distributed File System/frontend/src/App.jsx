import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }        from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TitleProvider }         from "./context/TitleContext";
import Landing    from "./pages/Landing";
import Login      from "./pages/Login";
import AppShell   from "./components/AppShell";
import GroupsHome from "./pages/GroupsHome";
import GroupView  from "./pages/GroupView";
import Settings   from "./pages/Settings";
import TitleBar   from "./components/TitleBar";
import { isDesktop } from "./lib/platform";

// The app (login + groups) lives in the desktop client. On the production web
// build it's gated off — only the landing page is served there. Dev keeps it
// reachable in the browser for convenience.
const appAllowed = isDesktop() || import.meta.env.DEV;

function RequireApp({ children }) {
  return appAllowed ? children : <Navigate to="/" replace />;
}

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <TitleProvider>
          <div className="flex flex-col h-screen">
            {isDesktop() && <TitleBar />}
            <div className="flex-1 min-h-0 overflow-y-auto">
          <Routes>
            <Route path="/"       element={isDesktop() ? <Navigate to="/login" replace /> : <Landing />} />
            <Route path="/login"  element={<RequireApp><Login /></RequireApp>} />
            <Route element={<RequireApp><RequireAuth><AppShell /></RequireAuth></RequireApp>}>
              <Route path="/groups"     element={<GroupsHome />} />
              <Route path="/groups/:id" element={<GroupView />} />
              <Route path="/settings"   element={<Settings />} />
            </Route>
            <Route path="/admin"      element={<Navigate to="/groups" replace />} />
            <Route path="/user"       element={<Navigate to="/groups" replace />} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
            </div>
          </div>
          </TitleProvider>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
