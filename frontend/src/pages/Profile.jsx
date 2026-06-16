import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission } from "@/lib/reminder";

const WEAK = ["Fluency", "Lexical Resource", "Grammar", "Pronunciation", "Task Achievement", "Coherence"];

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currPin, setCurrPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => { api.get("/profile").then((r) => setP(r.data)); }, []);

  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));
  const toggleWeak = (w) => set("weak_areas", p.weak_areas?.includes(w) ? p.weak_areas.filter((x) => x !== w) : [...(p.weak_areas || []), w]);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/profile", {
        target_band: p.target_band, current_band: p.current_band, test_date: p.test_date || null,
        daily_minutes: p.daily_minutes, tutor_voice: p.tutor_voice, tutor_personality: p.tutor_personality,
        native_language: p.native_language, weak_areas: p.weak_areas,
        reminder_enabled: p.reminder_enabled, reminder_time: p.reminder_time,
      });
      setP(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save");
    } finally { setBusy(false); }
  };

  const enableReminder = async () => {
    const result = await requestNotificationPermission();
    if (result === "granted") {
      set("reminder_enabled", true);
      toast.success("Notifications enabled — drill reminder will fire at your chosen time");
    } else if (result === "unsupported") {
      toast.error("This browser doesn't support notifications");
    } else {
      toast.error("Permission denied — enable in browser settings");
    }
  };

  const changePin = async () => {
    if (!/^\d{6}$/.test(currPin) || !/^\d{6}$/.test(newPin)) {
      toast.error("PIN must be 6 digits"); return;
    }
    if (newPin !== confirmPin) { toast.error("New PIN doesn't match confirmation"); return; }
    setPinBusy(true);
    try {
      await api.post("/auth/change-pin", { current_pin: currPin, new_pin: newPin });
      toast.success("PIN changed");
      setCurrPin(""); setNewPin(""); setConfirmPin("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to change PIN");
    } finally { setPinBusy(false); }
  };

  if (!p) return <div className="text-[#8A958F]">Loading...</div>;

  return (
    <div className="space-y-8 max-w-3xl" data-testid="profile-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Settings</div>
        <h1 className="font-serif-display text-3xl sm:text-4xl mt-2">Your IELTS plan</h1>
        <p className="text-sm text-[#4A5550] mt-3">{user?.name}</p>
      </header>

      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-7">
        <div>
          <Label className="text-sm">Target band</Label>
          <div className="flex items-center gap-4 sm:gap-6 mt-3">
            <Slider value={[p.target_band]} min={4} max={9} step={0.5} onValueChange={(v) => set("target_band", v[0])} data-testid="profile-target-slider" />
            <span className="font-serif-display text-2xl text-[#2D6A4F] w-14 text-right">{p.target_band.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <Label className="text-sm">Current band</Label>
          <div className="flex items-center gap-4 sm:gap-6 mt-3">
            <Slider value={[p.current_band]} min={3} max={9} step={0.5} onValueChange={(v) => set("current_band", v[0])} data-testid="profile-current-slider" />
            <span className="font-serif-display text-2xl text-[#E07A5F] w-14 text-right">{p.current_band.toFixed(1)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-sm">Test date</Label>
            <Input data-testid="profile-test-date" type="date" value={p.test_date || ""} onChange={(e) => set("test_date", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">Daily minutes</Label>
            <div className="flex items-center gap-3 mt-3">
              <Slider value={[p.daily_minutes]} min={10} max={180} step={5} onValueChange={(v) => set("daily_minutes", v[0])} data-testid="profile-daily-slider" />
              <span className="text-sm w-16 text-right">{p.daily_minutes} min</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-sm">Examiner voice</Label>
            <Select value={p.tutor_voice} onValueChange={(v) => set("tutor_voice", v)}>
              <SelectTrigger className="mt-1.5" data-testid="profile-voice-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Feedback style</Label>
            <Select value={p.tutor_personality} onValueChange={(v) => set("tutor_personality", v)}>
              <SelectTrigger className="mt-1.5" data-testid="profile-personality-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="encouraging">Encouraging</SelectItem>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-sm">Native language</Label>
          <Input data-testid="profile-native-input" value={p.native_language} onChange={(e) => set("native_language", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-sm">Weak areas</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {WEAK.map((w) => {
              const active = p.weak_areas?.includes(w);
              return (
                <button key={w} type="button" onClick={() => toggleWeak(w)} data-testid={`profile-weak-${w.toLowerCase().replace(/\s/g,'-')}`} className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${active ? "bg-[#E8EFE9] border-[#2D6A4F]" : "bg-white border-[#E5E2DC]"}`}>{w}</button>
              );
            })}
          </div>
        </div>

        <Button onClick={save} disabled={busy} data-testid="profile-save-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11 w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>

      {/* Daily reminder */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-5" data-testid="reminder-section">
        <div className="flex items-center gap-2">
          {p.reminder_enabled ? <Bell className="h-4 w-4 text-[#2D6A4F]" /> : <BellOff className="h-4 w-4 text-[#8A958F]" />}
          <h2 className="font-serif-display text-xl">Daily drill reminder</h2>
        </div>
        <p className="text-xs text-[#8A958F] -mt-2">Get a gentle push at your chosen time. Works best when the app is installed as a PWA.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-1">
            <Label className="text-sm">Reminder time</Label>
            <Input data-testid="reminder-time-input" type="time" value={p.reminder_time || "07:00"} onChange={(e) => set("reminder_time", e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2 flex gap-2 flex-wrap">
            {!p.reminder_enabled ? (
              <Button onClick={enableReminder} data-testid="reminder-enable-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full">
                <Bell className="h-4 w-4 mr-2" /> Enable reminders
              </Button>
            ) : (
              <Button onClick={() => set("reminder_enabled", false)} variant="outline" data-testid="reminder-disable-btn" className="rounded-full">
                <BellOff className="h-4 w-4 mr-2" /> Turn off
              </Button>
            )}
            <Button onClick={save} disabled={busy} variant="ghost" className="rounded-full" data-testid="reminder-save-btn">Save</Button>
          </div>
        </div>
        {p.reminder_enabled && typeof Notification !== "undefined" && Notification.permission !== "granted" && (
          <div className="text-xs text-[#E07A5F] bg-[#FCEEEA] border border-[#E07A5F]/30 rounded-lg p-3">
            Notification permission isn't granted — tap "Enable reminders" to grant it again.
          </div>
        )}
      </div>

      {/* Change PIN */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-5" data-testid="change-pin-section">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#2D6A4F]" />
          <h2 className="font-serif-display text-xl">Change PIN</h2>
        </div>
        <p className="text-xs text-[#8A958F] -mt-2">6 digits. This is the only way to unlock the app.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Current PIN</Label>
            <Input data-testid="curr-pin-input" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} value={currPin} onChange={(e) => setCurrPin(e.target.value.replace(/\D/g, ""))} className="mt-1.5 font-mono tracking-[0.4em]" />
          </div>
          <div>
            <Label className="text-sm">New PIN</Label>
            <Input data-testid="new-pin-input" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} className="mt-1.5 font-mono tracking-[0.4em]" />
          </div>
          <div>
            <Label className="text-sm">Confirm new PIN</Label>
            <Input data-testid="confirm-pin-input" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} className="mt-1.5 font-mono tracking-[0.4em]" />
          </div>
        </div>
        <Button onClick={changePin} disabled={pinBusy} data-testid="change-pin-btn" className="bg-[#1A201C] hover:bg-black text-white rounded-full px-6 h-11 w-full sm:w-auto">
          {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update PIN"}
        </Button>
      </div>
    </div>
  );
}
