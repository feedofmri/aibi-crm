import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth, RedirectIfSignedIn } from "@/features/auth/RouteGuards";
import { LoginPage } from "@/features/auth/LoginPage";
import { AutomationPage } from "@/features/automation/AutomationPage";
import { WeeklyBriefPage } from "@/features/brief/WeeklyBriefPage";
import { EnquiriesPage } from "@/features/enquiries/EnquiriesPage";
import { FollowUpsPage } from "@/features/followups/FollowUpsPage";
import { PipelinePage } from "@/features/pipeline/PipelinePage";
import { TeamPage } from "@/features/team/TeamPage";
import { NotFoundPage } from "./NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <RedirectIfSignedIn>
        <LoginPage />
      </RedirectIfSignedIn>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/pipeline" replace /> },
      { path: "pipeline", element: <PipelinePage /> },
      { path: "enquiries", element: <EnquiriesPage /> },
      { path: "follow-ups", element: <FollowUpsPage /> },
      { path: "brief", element: <WeeklyBriefPage /> },
      { path: "automation", element: <AutomationPage /> },
      { path: "team", element: <TeamPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
