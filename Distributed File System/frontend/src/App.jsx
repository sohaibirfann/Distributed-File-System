import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider }        from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import User  from "./pages/User";

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user)                   return <Navigate to="/" replace />;
  if (user.role !== "admin")   return <Navigate to="/user" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            <Route path="/"      element={<Login />} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/user"  element={<RequireAuth><User /></RequireAuth>} />
            <Route path="*"      element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
