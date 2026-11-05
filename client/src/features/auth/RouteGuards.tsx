import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { PageLoader } from "@/components/ui";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Checking your session" />;
  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to={`/login${from !== "/" ? `?from=${encodeURIComponent(from)}` : ""}`} replace />;
  }
  return children;
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Checking your session" />;
  if (user) return <Navigate to="/pipeline" replace />;
  return children;
}
