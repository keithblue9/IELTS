import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, Bell, BellOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission } from "@/lib/reminder";

const WEAK = ["Fluency", "Lexical Resource", "Grammar", "Pronunciation", "Task Achievement", "Coherence"];

const VOICES = [
  { value: "Bella",     label: "Bella — lembut, manis (default)" },
  { value: "Rachel",    label: "Rachel — hangat, sabar" },
  { value: "Domi",      label: "Domi — playful, ekspresif" },
  { value: "Freya",     label: "Freya — soft, intim" },
  { value: "Lily",      label: "Lily — friendly" },
  { value: "Charlotte", label: "Charlotte — calm" },
  { value: "Alice",     label: "Alice — bright, ceria" },
];

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [currPin, setCurrPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => { api.get("/profile").then((r) => setP(r.data)); }, []);

  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));
  const toggleWeak = (w) =>
    set("weak_areas", p.weak_areas?.includes(w)
      ? p.weak_areas.filter((x) => x !== w)
      : [...(p.weak_areas || []), w]);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/profile", {
        target_band: p.target_band,
        current_band: p.current_band,
        test_date: p.test_date || null,
        daily_minutes: p.daily_minutes,
        tutor_voice: p.tutor_voice,
        tutor_voice_stability: p.tutor_voice_stability,
        tutor_voice_style: p.tutor_voice_style,
        tutor_personality: p.tutor_personality,
        native_language: p.native_language,
        weak_areas: p.weak_areas,
        reminder_enabled: p.reminder_enabled,
        reminder_time: p.reminder_time,
      });
      setP(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save");
    } finally { setBusy(false); }
  };

  const previewVoice = async () => {
    setPreviewBusy(true);
    try {
      const res = await api.post("/tts", {
        text: "Hello, lovely to see you. Let's begin today's session — are you ready, sweetheart?",
        voice: p.tutor_voice,
        stability: p.tutor_voice_stability,
        style: p.tutor_voice_style,
      }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      toast.error("Preview failed — save settings first or check API key");
    } finally {
      setPreviewBusy(false);
    }
  };

  const enableReminder = async () => {
    const result = await requestNotificationPermission();
    if (result === "granted") {
      set("reminder_enabled", true);
      toast.success("Notifications enabled");
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

  const stability = p.tutor_voice_stability ?? 0.35;
  const style = p.tutor_voice_style ?? 0.65;

  return (
    <div className="space-y-8 max-w-3xl" data-testid="profile-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Settings</div>
        <h1 className="font-serif-display text-3xl mt-1">Profile</h1>
        <p className="text-sm text-[#4A5550] mt-1">Customize your tutor and learning targets.</p>
      </header>

      {/* Profile + voice */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-sm">Target band</Label>
            <Input
              type="number" step="0.5" min="4" max="9"
              value={p.target_band}
              onChange={(e) => set("target_band", parseFloat(e.target.value))}
              className="mt-1.5"
              data-testid="profile-target-input"
            />
          </div>
          <div>
            <Label className="text-sm">Daily minutes</Label>
            <Input
              type="number" min="5" max="180"
              value={p.daily_minutes}
              onChange={(e) => set("daily_minutes", parseInt(e.target.value, 10))}
              className="mt-1.5"
              data-testid="profile-daily-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-sm">Tutor voice</Label>
            <Select value={p.tutor_voice} onValueChange={(v) => set("tutor_voice", v)}>
              <SelectTrigger className="mt-1.5" data-testid="profile-voice-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
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

        {/* Voice character sliders */}
        <div className="bg-[#F9F8F6] border border-[#E5E2DC] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-[#2D6A4F]" />
            <Label className="text-sm font-medium">Voice character</Label>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <Label className="text-xs text-[#4A5550]">Expressiveness (style)</Label>
              <span className="text-xs text-[#8A958F]">{style.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={style}
              onChange={(e) => set("tutor_voice_style", parseFloat(e.target.value))}
              className="w-full accent-[#2D6A4F]"
              data-testid="profile-voice-style"
            />
            <p className="text-[11px] text-[#8A958F] mt-1">Tinggi = lebih ekspresif & breathy · Rendah = netral</p>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <Label className="text-xs text-[#4A5550]">Stability</Label>
              <span className="text-xs text-[#8A958F]">{stability.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={stability}
              onChange={(e) => set("tutor_voice_stability", parseFloat(e.target.value))}
              className="w-full accent-[#2D6A4F]"
              data-testid="profile-voice-stability"
            />
            <p className="text-[11px] text-[#8A958F] mt-1">Rendah = variatif penuh emosi · Tinggi = monoton stabil</p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={previewVoice}
            disabled={previewBusy}
            data-testid="profile-voice-preview"
            className="w-full sm:w-auto rounded-full"
          >
            {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Volume2 className="h-4 w-4 mr-2" />Preview voice</>}
          </Button>
        </div>

        <div>
          <Label className="text-sm">Native language</Label>
          <Input
            data-testid="profile-native-input"
            value={p.native_language}
            onChange={(e) => set("native_language", e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label className="text-sm">Weak areas</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {WEAK.map((w) => {
              const active = p.weak_areas?.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeak(w)}
                  data-testid={`profile-weak-${w.toLowerCase().replace(/\s/g, '-')}`}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${active ? "bg-[#E8EFE9] border-[#2D6A4F]" : "bg-white border-[#E5E2DC]"}`}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          onClick={save}
          disabled={busy}
          data-testid="profile-save-btn"
          className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11 w-full sm:w-auto"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>

      {/* Daily reminder */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-5" data-testid="reminder-section">
        <div className="flex items-center gap-2">
          {p.reminder_enabled ? <Bell className="h-4 w-4 text-[#2D6A4F]" /> : <BellOff className="h-4 w-4 text-[#8A958F]" />}
          <h2 className="font-serif-display text-xl">Daily drill reminder</h2>
        </div>
        <p className="text-xs text-[#8A958F] -mt-2">Get a gentle push at your chosen time.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-sm">Reminder time</Label>
            <Input
              type="time"
              value={p.reminder_time}
              onChange={(e) => set("reminder_time", e.target.value)}
              className="mt-1.5"
              data-testid="reminder-time-input"
            />
          </div>
          <div className="flex items-end">
            {!p.reminder_enabled ? (
              <Button
                onClick={enableReminder}
                variant="outline"
                className="rounded-full w-full sm:w-auto"
                data-testid="reminder-enable-btn"
              >
                Enable reminder
              </Button>
            ) : (
              <Button
                onClick={() => set("reminder_enabled", false)}
                variant="outline"
                className="rounded-full w-full sm:w-auto"
                data-testid="reminder-disable-btn"
              >
                Disable
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PIN change */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#2D6A4F]" />
          <h2 className="font-serif-display text-xl">Change PIN</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            type="password" inputMode="numeric" maxLength="6" placeholder="Current PIN"
            value={currPin} onChange={(e) => setCurrPin(e.target.value.replace(/\D/g, ""))}
            data-testid="pin-current-input"
          />
          <Input
            type="password" inputMode="numeric" maxLength="6" placeholder="New PIN"
            value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            data-testid="pin-new-input"
          />
          <Input
            type="password" inputMode="numeric" maxLength="6" placeholder="Confirm new PIN"
            value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            data-testid="pin-confirm-input"
          />
        </div>
        <Button
          onClick={changePin}
          disabled={pinBusy}
          variant="outline"
          className="rounded-full"
          data-testid="pin-save-btn"
        >
          {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update PIN"}
        </Button>
      </div>
    </div>
  );
}
