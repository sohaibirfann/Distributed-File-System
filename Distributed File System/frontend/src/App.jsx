import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }        from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing   from "./pages/Landing";
import Login     from "./pages/Login";
import Groups    from "./pages/Groups";
import GroupView from "./pages/GroupView";

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            <Route path="/"       element={<Landing />} />
            <Route path="/login"  element={<Login />} />
            <Route path="/groups"     element={<RequireAuth><Groups /></RequireAuth>} />
            <Route path="/groups/:id" element={<RequireAuth><GroupView /></RequireAuth>} />
            <Route path="/admin"      element={<Navigate to="/groups" replace />} />
            <Route path="/user"       element={<Navigate to="/groups" replace />} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
