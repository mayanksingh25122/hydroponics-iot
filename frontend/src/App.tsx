import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RedirectIfAuthenticated } from "./components/auth/RedirectIfAuthenticated";
import { useAuthStore } from "./store/useAuthStore";

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            {/* Nested inside RequireAuth (which has already confirmed a
                session) and AppShell (same chrome as every other
                authenticated page) — RequireAdmin only adds the role
                check on top. A signed-in non-admin who navigates here
                is sent to "/", not "/login": UX only, see
                RequireAdmin's own docstring for the real boundary. */}
            <Route element={<RequireAdmin />}>
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>
          </Route>
        </Route>
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
    </BrowserRouter>
  );
}
