import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Mic, PenLine, Headphones, BookOpen, LayoutDashboard, Settings, LogOut, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/app", label: "Home", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/app/speaking", label: "Speak", icon: Mic, testid: "nav-speaking" },
  { to: "/app/writing", label: "Write", icon: PenLine, testid: "nav-writing" },
  { to: "/app/listening", label: "Listen", icon: Headphones, testid: "nav-listening" },
  { to: "/app/reading", label: "Read", icon: BookOpen, testid: "nav-reading" },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#E5E2DC] bg-[#F9F8F6]/90 backdrop-blur sticky top-0 z-40 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2" data-testid="logo-link">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-[#F9F8F6]">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-serif-display text-base sm:text-lg font-medium text-[#1A201C]">Ascent</div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#8A958F]">AI IELTS Mentor</div>
            </div>
          </Link>

          {/* Desktop nav */}
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/app/profile")}
              data-testid="nav-profile"
              className="h-9 w-9 rounded-full bg-[#E07A5F] text-white flex items-center justify-center text-sm font-medium hover:-translate-y-0.5 transition-transform"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <Button
              data-testid="logout-btn"
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-[#4A5550] h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 pb-24 md:pb-10">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#E5E2DC] safe-bottom">
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`${n.testid}-mobile`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2.5 gap-1 ${
                  isActive ? "text-[#2D6A4F]" : "text-[#8A958F]"
                }`
              }
            >
              <n.icon className="h-5 w-5" />
              <span className="text-[10px] uppercase tracking-wider">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
