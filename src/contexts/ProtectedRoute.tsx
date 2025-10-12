// # ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  // # Redirect if not logged in
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
