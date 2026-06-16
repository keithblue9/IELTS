import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Mic, PenLine, Headphones, BookOpen, LayoutDashboard, Settings, LogOut, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/app/speaking", label: "Speaking", icon: Mic, testid: "nav-speaking" },
  { to: "/app/writing", label: "Writing", icon: PenLine, testid: "nav-writing" },
  { to: "/app/listening", label: "Listening", icon: Headphones, testid: "nav-listening" },
  { to: "/app/reading", label: "Reading", icon: BookOpen, testid: "nav-reading" },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      {/* Top nav */}
      <header className="border-b border-[#E5E2DC] bg-[#F9F8F6]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 group" data-testid="logo-link">
            <div className="h-9 w-9 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-[#F9F8F6]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-serif-display text-lg font-medium text-[#1A201C]">Ascent IELTS</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8A958F]">AI Mentor · band 9</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive ? "bg-[#2D6A4F] text-[#F9F8F6]" : "text-[#4A5550] hover:bg-[#EFEBE3]"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/app/profile")}
              data-testid="nav-profile"
              className="h-9 w-9 rounded-full bg-[#E07A5F] text-white flex items-center justify-center text-sm font-medium hover:-translate-y-0.5 transition-transform"
              title="Profile"
            >
              {(user?.name || "?").charAt(0).toUpperCase()}
            </button>
            <Button
              data-testid="logout-btn"
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-[#4A5550]"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* mobile nav */}
        <div className="md:hidden border-t border-[#E5E2DC] px-2 py-2 flex items-center gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`${n.testid}-mobile`}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${
                  isActive ? "bg-[#2D6A4F] text-[#F9F8F6]" : "text-[#4A5550] bg-[#F0ECE4]"
                }`
              }
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/app/profile" data-testid="nav-profile-mobile" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[#4A5550] bg-[#F0ECE4]">
            <Settings className="h-3.5 w-3.5" /> Settings
          </NavLink>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-10">{children}</main>
    </div>
  );
}
