import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }        from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Login   from "./pages/Login";
import Admin   from "./pages/Admin";
import User    from "./pages/User";
import Groups  from "./pages/Groups";

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user)                 return <Navigate to="/"     replace />;
  if (user.role !== "admin") return <Navigate to="/user" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            <Route path="/"       element={<Landing />} />
            <Route path="/login"  element={<Login />} />
            <Route path="/admin"  element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/user"   element={<RequireAuth><User /></RequireAuth>} />
            <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
