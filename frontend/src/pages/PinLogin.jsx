import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GraduationCap, Lock } from "lucide-react";

const PIN_LEN = 6;

export default function PinLogin() {
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const [digits, setDigits] = useState(Array(PIN_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
    refs.current[0]?.focus();
  }, [user, navigate]);

  const setAt = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < PIN_LEN - 1) refs.current[i + 1]?.focus();
    if (next.every((d) => d !== "") && next.join("").length === PIN_LEN) {
      submit(next.join(""));
    }
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < PIN_LEN - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, PIN_LEN);
    if (txt.length === PIN_LEN) {
      e.preventDefault();
      setDigits(txt.split(""));
      submit(txt);
    }
  };

  const submit = async (pin) => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/pin-login", { pin });
      localStorage.setItem("ielts_token", data.token);
      setUser(data.user);
      toast.success("Welcome back");
      navigate("/app");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Wrong PIN");
      setDigits(Array(PIN_LEN).fill(""));
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center px-6 grain-bg safe-top">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 mb-10 mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-[#2D6A4F] flex items-center justify-center text-[#F9F8F6]">
            <GraduationCap className="h-6 w-6" />
          </div>
        </div>
        <h1 className="font-serif-display text-4xl mb-2">Ascent IELTS</h1>
        <p className="text-[#4A5550] mb-10 text-sm">Enter your 6-digit PIN to continue</p>
        <div className="flex justify-center gap-2 sm:gap-3 mb-8" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              data-testid={`pin-digit-${i}`}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              disabled={busy}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-serif-display rounded-xl border border-[#E5E2DC] bg-white focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-all"
            />
          ))}
        </div>
        <div className="text-xs text-[#8A958F] flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" /> Default PIN is <span className="font-mono text-[#1A201C]">123456</span> — change it in Settings.
        </div>
        {busy && <div className="text-xs text-[#8A958F] mt-3">Signing in…</div>}
      </div>
    </div>
  );
}
