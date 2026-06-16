import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const WEAK = ["Fluency", "Lexical Resource", "Grammar", "Pronunciation", "Task Achievement", "Coherence"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState(7.0);
  const [current, setCurrent] = useState(5.5);
  const [testDate, setTestDate] = useState("");
  const [daily, setDaily] = useState(30);
  const [voice, setVoice] = useState("nova");
  const [personality, setPersonality] = useState("encouraging");
  const [native, setNative] = useState("Indonesian");
  const [weak, setWeak] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleWeak = (w) => setWeak((arr) => (arr.includes(w) ? arr.filter((x) => x !== w) : [...arr, w]));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/profile", {
        target_band: target,
        current_band: current,
        test_date: testDate || null,
        daily_minutes: daily,
        tutor_voice: voice,
        tutor_personality: personality,
        native_language: native,
        weak_areas: weak,
      });
      toast.success("Plan saved!");
      navigate("/app");
    } catch (e) {
      toast.error("Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] grain-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F] mb-3">Step {step} of 3</div>
        <h1 className="font-serif-display text-4xl mb-2">Build your IELTS plan</h1>
        <p className="text-[#4A5550] mb-10">A few quick questions so Aria can calibrate your training.</p>

        <div className="bg-white border border-[#E5E2DC] rounded-2xl p-8">
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <Label className="text-sm">Target band</Label>
                <div className="flex items-center gap-6 mt-3">
                  <Slider value={[target]} min={4} max={9} step={0.5} onValueChange={(v) => setTarget(v[0])} data-testid="onboarding-target-slider" />
                  <span className="font-serif-display text-3xl text-[#2D6A4F] w-16 text-right">{target.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Current band (estimate)</Label>
                <div className="flex items-center gap-6 mt-3">
                  <Slider value={[current]} min={3} max={9} step={0.5} onValueChange={(v) => setCurrent(v[0])} data-testid="onboarding-current-slider" />
                  <span className="font-serif-display text-3xl text-[#E07A5F] w-16 text-right">{current.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Test date (optional)</Label>
                <Input data-testid="onboarding-test-date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <Label className="text-sm">Daily study minutes</Label>
                <div className="flex items-center gap-6 mt-3">
                  <Slider value={[daily]} min={10} max={180} step={5} onValueChange={(v) => setDaily(v[0])} data-testid="onboarding-daily-slider" />
                  <span className="font-serif-display text-2xl w-20 text-right">{daily}<span className="text-xs text-[#8A958F]"> min</span></span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Native language</Label>
                <Input data-testid="onboarding-native-input" value={native} onChange={(e) => setNative(e.target.value)} className="mt-1.5" />
                <p className="text-xs text-[#8A958F] mt-1.5">Aria uses this to anticipate common mistakes.</p>
              </div>
              <div>
                <Label className="text-sm">Weak areas (pick all that apply)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {WEAK.map((w) => (
                    <label key={w} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${weak.includes(w) ? "border-[#2D6A4F] bg-[#E8EFE9]" : "border-[#E5E2DC] bg-white"}`}>
                      <Checkbox checked={weak.includes(w)} onCheckedChange={() => toggleWeak(w)} data-testid={`onboarding-weak-${w.toLowerCase().replace(/\s/g, "-")}`} />
                      {w}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <Label className="text-sm">Examiner voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger data-testid="onboarding-voice-select" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">Nova — energetic, upbeat</SelectItem>
                    <SelectItem value="shimmer">Shimmer — bright, cheerful</SelectItem>
                    <SelectItem value="alloy">Alloy — neutral, balanced</SelectItem>
                    <SelectItem value="echo">Echo — smooth, calm</SelectItem>
                    <SelectItem value="onyx">Onyx — deep, authoritative</SelectItem>
                    <SelectItem value="sage">Sage — wise, measured</SelectItem>
                    <SelectItem value="fable">Fable — expressive, storytelling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Feedback style</Label>
                <Select value={personality} onValueChange={setPersonality}>
                  <SelectTrigger data-testid="onboarding-personality-select" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="encouraging">Encouraging</SelectItem>
                    <SelectItem value="strict">Strict (real examiner)</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-[#F0ECE4] rounded-xl p-5">
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Your plan</div>
                <div className="mt-2 font-serif-display text-2xl">Target {target.toFixed(1)} · {daily} min/day · {voice}</div>
              </div>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)} data-testid="onboarding-back-btn">Back</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} className="bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-6" data-testid="onboarding-next-btn">Continue</Button>
            ) : (
              <Button onClick={save} disabled={saving} className="bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-6" data-testid="onboarding-finish-btn">
                {saving ? "Saving..." : "Start training"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
