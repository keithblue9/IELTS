import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/profile").then((r) => setP(r.data)); }, []);

  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/profile", {
        target_band: p.target_band, current_band: p.current_band, test_date: p.test_date || null,
        daily_minutes: p.daily_minutes, tutor_voice: p.tutor_voice, tutor_personality: p.tutor_personality,
        native_language: p.native_language, weak_areas: p.weak_areas,
      });
      setP(data);
      toast.success("Profile saved");
    } catch (e) {
      toast.error("Failed to save");
    } finally { setBusy(false); }
  };

  if (!p) return <div className="text-[#8A958F]">Loading...</div>;

  return (
    <div className="space-y-8 max-w-3xl" data-testid="profile-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Account</div>
        <h1 className="font-serif-display text-4xl mt-2">Your IELTS plan</h1>
        <p className="text-[#4A5550] mt-3">{user?.name} · {user?.email}</p>
      </header>

      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-8 space-y-7">
        <div>
          <Label className="text-sm">Target band</Label>
          <div className="flex items-center gap-6 mt-3">
            <Slider value={[p.target_band]} min={4} max={9} step={0.5} onValueChange={(v) => set("target_band", v[0])} data-testid="profile-target-slider" />
            <span className="font-serif-display text-2xl text-[#2D6A4F] w-14 text-right">{p.target_band.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <Label className="text-sm">Current band</Label>
          <div className="flex items-center gap-6 mt-3">
            <Slider value={[p.current_band]} min={3} max={9} step={0.5} onValueChange={(v) => set("current_band", v[0])} data-testid="profile-current-slider" />
            <span className="font-serif-display text-2xl text-[#E07A5F] w-14 text-right">{p.current_band.toFixed(1)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

        <Button onClick={save} disabled={busy} data-testid="profile-save-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
