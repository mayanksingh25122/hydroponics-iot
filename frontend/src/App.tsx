import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RedirectIfAuthenticated } from "./components/auth/RedirectIfAuthenticated";
import { useAuthStore } from "./store/useAuthStore";

/**
 * Every route is lazy, and that is a bundling decision rather than a
 * stylistic one.
 *
 * The public homepage and the dashboard have almost nothing in common:
 * the homepage needs a WebGL renderer and no data layer, the dashboard
 * needs charts and an API client and no renderer. Loading either eagerly
 * taxes visitors to the other — measured at ~174 KB gzip for a visitor
 * to "/" who never signs in. The top-level <Suspense> below is what
 * makes this safe.
 */
const AppShell = lazy(() => import("./components/layout/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MarketingLayout = lazy(() => import("./marketing/chrome/MarketingLayout"));
const HomePage = lazy(() => import("./marketing/pages/HomePage"));
const TowerPage = lazy(() => import("./marketing/pages/TowerPage"));
const FarmsPage = lazy(() => import("./marketing/pages/FarmsPage"));
const PlatformPage = lazy(() => import("./marketing/pages/PlatformPage"));
const ApproachPage = lazy(() => import("./marketing/pages/ApproachPage"));
const ResearchPage = lazy(() => import("./marketing/pages/ResearchPage"));
const ContactPage = lazy(() => import("./marketing/pages/ContactPage"));
const TowerLab = lazy(() => import("./marketing/lab/TowerLab"));

/** Neutral hold while a lazy chunk arrives — never a spinner on a cold load. */
function RouteFallback() {
  return <div className="min-h-screen bg-verda-canvas" />;
}

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ---------- Public marketing tier ---------- */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tower" element={<TowerPage />} />
            <Route path="/farms" element={<FarmsPage />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/approach" element={<ApproachPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>

          {/* 3D feasibility rig. Public and additive; not linked from the site. */}
          <Route path="/lab/tower" element={<TowerLab />} />

          {/* ---------- Application tier ----------
              Moved from "/" to "/app" so the root can be the public
              homepage. Every component below is unchanged — only the
              path they mount at moved, along with the four redirect
              targets that point back here. */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/analytics" element={<Analytics />} />
              <Route path="/app/settings" element={<Settings />} />
              {/* Nested inside RequireAuth (which has already confirmed a
                  session) and AppShell (same chrome as every other
                  authenticated page) — RequireAdmin only adds the role
                  check on top. A signed-in non-admin who navigates here
                  is sent to "/app", not "/login": UX only, see
                  RequireAdmin's own docstring for the real boundary. */}
              <Route element={<RequireAdmin />}>
                <Route path="/app/admin/users" element={<AdminUsers />} />
              </Route>
            </Route>
          </Route>

          {/* Anyone holding a link written before the move still lands
              somewhere correct rather than on the 404. */}
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/analytics" element={<Navigate to="/app/analytics" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
          <Route path="/admin/users" element={<Navigate to="/app/admin/users" replace />} />

          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          {/* Same guard as /login: someone already signed in has no use
              for a sign-up form and is sent on to the dashboard. */}
          <Route
            path="/signup"
            element={
              <RedirectIfAuthenticated>
                <Signup />
              </RedirectIfAuthenticated>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
