// # ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * A route that requires the user to be authenticated.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {JSX.Element} props.children - The child component to render if the user is authenticated.
 * @returns {JSX.Element} The rendered child component or a redirect to the login page.
 */
export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  // # Redirect if not logged in
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
