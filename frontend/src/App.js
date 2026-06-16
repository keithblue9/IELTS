import "@/App.css";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { useReminder } from "@/lib/reminder";
import api from "@/lib/api";
import PinLogin from "@/pages/PinLogin";
import Dashboard from "@/pages/Dashboard";
import Speaking from "@/pages/Speaking";
import Writing from "@/pages/Writing";
import Listening from "@/pages/Listening";
import Reading from "@/pages/Reading";
import Profile from "@/pages/Profile";
import Drill from "@/pages/Drill";
import Recap from "@/pages/Recap";
import AppLayout from "@/components/AppLayout";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center text-[#8A958F]">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <Protected>
      <AppLayout>{children}</AppLayout>
    </Protected>
  );
}

function GlobalHooks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user) api.get("/profile").then((r) => setProfile(r.data)).catch(() => {});
  }, [user]);

  useReminder(profile);

  // Listen for service worker navigation requests (notification clicks)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e) => {
      if (e.data?.type === "navigate" && e.data?.url) navigate(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  return null;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <GlobalHooks />
          <Routes>
            <Route path="/" element={<PinLogin />} />
            <Route path="/app" element={<Shell><Dashboard /></Shell>} />
            <Route path="/app/speaking" element={<Shell><Speaking /></Shell>} />
            <Route path="/app/writing" element={<Shell><Writing /></Shell>} />
            <Route path="/app/listening" element={<Shell><Listening /></Shell>} />
            <Route path="/app/reading" element={<Shell><Reading /></Shell>} />
            <Route path="/app/drill" element={<Shell><Drill /></Shell>} />
            <Route path="/app/recap" element={<Shell><Recap /></Shell>} />
            <Route path="/app/profile" element={<Shell><Profile /></Shell>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
