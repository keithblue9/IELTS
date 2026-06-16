import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Speaking from "@/pages/Speaking";
import Writing from "@/pages/Writing";
import Listening from "@/pages/Listening";
import Reading from "@/pages/Reading";
import Profile from "@/pages/Profile";
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
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <Protected>
      <AppLayout>{children}</AppLayout>
    </Protected>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
            <Route path="/app" element={<Shell><Dashboard /></Shell>} />
            <Route path="/app/speaking" element={<Shell><Speaking /></Shell>} />
            <Route path="/app/writing" element={<Shell><Writing /></Shell>} />
            <Route path="/app/listening" element={<Shell><Listening /></Shell>} />
            <Route path="/app/reading" element={<Shell><Reading /></Shell>} />
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
