import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Headphones, Loader2, Play, Pause, CheckCircle2, XCircle, RotateCw, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export default function Listening() {
  const [tests, setTests] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [playingSec, setPlayingSec] = useState(null);
  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({});

  useEffect(() => { api.get("/listening/tests").then((r) => setTests(r.data.slice(0, 6))); }, []);

  const openTest = async (id) => {
    setResult(null); setAnswers({}); setAudioCache({});
    const { data } = await api.get(`/listening/tests/${id}`);
    setActive(data);
  };

  const generateTest = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/listening/generate?topic_hint=${encodeURIComponent(topic || "everyday situations")}`);
      setActive(data);
      setAnswers({});
      setResult(null);
      setAudioCache({});
      const refreshed = await api.get("/listening/tests");
      setTests(refreshed.data.slice(0, 6));
      toast.success("Fresh test generated!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Generation failed — try again");
    } finally { setGenerating(false); }
  };

  const playSection = async (idx, script) => {
    if (audioRef.current && playingSec === idx) {
      audioRef.current.pause();
      setPlayingSec(null);
      return;
    }
    let url = audioCache[idx];
    if (!url) {
      try {
        toast.message("Loading audio…");
        const res = await api.post("/tts", { text: script, voice: "nova" }, { responseType: "blob" });
        url = URL.createObjectURL(res.data);
        setAudioCache((c) => ({ ...c, [idx]: url }));
      } catch (e) {
        toast.error("Audio failed"); return;
      }
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlayingSec(null);
      audioRef.current.play();
      setPlayingSec(idx);
    }
  };

  const setAns = (qn, v) => setAnswers((a) => ({ ...a, [String(qn)]: v }));

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const { data } = await api.post("/listening/submit", { test_id: active.id, answers });
      setResult(data);
      toast.success(`Score: ${data.correct}/${data.total} · Band ${data.band}`);
      // refresh list so this attempt shows
      const refreshed = await api.get("/listening/tests");
      setTests(refreshed.data.slice(0, 6));
    } catch (e) {
      toast.error("Failed to submit");
    } finally { setBusy(false); }
  };

  if (!active) {
    return (
      <div className="space-y-6 sm:space-y-8" data-testid="listening-page">
        <header>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">IELTS · Listening</div>
          <h1 className="font-serif-display text-3xl sm:text-4xl mt-2">Train your ears</h1>
          <p className="text-sm sm:text-base text-[#4A5550] mt-3 max-w-2xl">Every test is freshly generated — never the same questions twice. 4 sections, 20 questions, AI-narrated.</p>
        </header>
        <Card className="p-5 sm:p-6 border-[#E5E2DC]">
          <h3 className="font-serif-display text-xl">Generate a new test</h3>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Input data-testid="listening-topic-input" placeholder="Theme (e.g. travel, university orientation)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <Button onClick={generateTest} disabled={generating} data-testid="listening-generate-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</> : "Generate test"}
            </Button>
          </div>
          {generating && <p className="text-xs text-[#8A958F] mt-3">Takes about 45 seconds. Aria is writing 4 narrated dialogues and 20 questions.</p>}
        </Card>

        {tests.length > 0 && (
          <section>
            <h3 className="font-serif-display text-xl mb-4">Recent tests</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {tests.map((t) => (
                <button key={t.id} onClick={() => openTest(t.id)} data-testid={`listening-test-${t.id}`} className="text-left bg-white border border-[#E5E2DC] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all">
                  <Headphones className="h-5 w-5 text-[#E9C46A]" />
                  <div className="font-serif-display text-lg mt-3">{t.title}</div>
                  <div className="text-xs text-[#8A958F] mt-1">{t.sections?.length || 4} sections · {new Date(t.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  const total = active.sections?.reduce((s, sec) => s + sec.questions.length, 0) || 0;

  return (
    <div className="space-y-5" data-testid="listening-active">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => { setActive(null); setResult(null); }} className="text-sm text-[#2D6A4F]" data-testid="listening-back-btn">← Back</button>
        <Button onClick={generateTest} disabled={generating} variant="outline" size="sm" data-testid="listening-new-btn" className="rounded-full text-xs">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCw className="h-3.5 w-3.5 mr-1.5" /> New test</>}
        </Button>
      </div>
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Listening test</div>
        <h1 className="font-serif-display text-2xl sm:text-3xl mt-1">{active.title}</h1>
      </header>
      <audio ref={audioRef} className="hidden" />

      <div className="space-y-5">
        {active.sections?.map((sec, idx) => (
          <div key={idx} className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Section {sec.section}</div>
                <h3 className="font-serif-display text-lg sm:text-2xl mt-1">{sec.title}</h3>
              </div>
              <Button onClick={() => playSection(idx, sec.script)} data-testid={`listening-play-sec-${sec.section}`} variant="outline" className="rounded-full" size="sm">
                {playingSec === idx ? <><Pause className="h-4 w-4 mr-2" /> Pause</> : <><Play className="h-4 w-4 mr-2" /> Play audio</>}
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {sec.questions?.map((q) => {
                const r = result?.review?.find((rr) => rr.q_number === q.q_number);
                return (
                  <div key={q.q_number} className="text-sm" data-testid={`listening-q-${q.q_number}`}>
                    <div className="text-[#1A201C] mb-2"><span className="text-[#8A958F] mr-2">{q.q_number}.</span>{q.question}</div>
                    {q.options ? (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => {
                          const letter = opt.match(/^[A-Z]\b/)?.[0] || opt;
                          const value = letter.length === 1 ? letter : opt;
                          const sel = answers[String(q.q_number)] === value;
                          return (
                            <button key={opt} disabled={!!result} onClick={() => setAns(q.q_number, value)} data-testid={`listening-q${q.q_number}-${value}`} className={`px-3 py-1.5 rounded-full text-xs border ${sel ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "bg-white border-[#E5E2DC] text-[#1A201C]"} ${result ? "opacity-70 cursor-default" : ""}`}>{opt}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <Input data-testid={`listening-q${q.q_number}-input`} disabled={!!result} value={answers[String(q.q_number)] || ""} onChange={(e) => setAns(q.q_number, e.target.value)} placeholder="Type answer (max 3 words)" className="max-w-sm" />
                    )}
                    {r && (
                      <div className="mt-2 space-y-1.5">
                        <div className={`text-xs flex items-center gap-1.5 ${r.is_correct ? "text-[#2D6A4F]" : "text-[#E07A5F]"}`}>
                          {r.is_correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Correct: <span className="font-medium">{r.correct_answer}</span>
                        </div>
                        {r.explanation && (
                          <div className="bg-[#F0ECE4] rounded-lg p-3 text-xs text-[#1A201C] leading-relaxed flex gap-2" data-testid={`listening-explain-${q.q_number}`}>
                            <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-[#E9C46A] shrink-0" /> {r.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-20 md:bottom-4 z-30 bg-white border border-[#E5E2DC] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg flex-wrap">
        <div className="text-sm">
          <span className="text-[#8A958F]">Answered </span>
          <span className="font-medium">{Object.keys(answers).length}</span>
          <span className="text-[#8A958F]"> / {total}</span>
        </div>
        {result ? (
          <div className="flex items-center gap-3">
            <div>
              <span className="font-serif-display text-2xl text-[#2D6A4F] mr-1">{result.band}</span>
              <span className="text-xs text-[#8A958F]">band</span>
              <span className="text-xs text-[#8A958F] ml-2">({result.correct}/{result.total})</span>
            </div>
            <Button onClick={generateTest} disabled={generating} size="sm" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full" data-testid="listening-new-after-submit">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCw className="h-3.5 w-3.5 mr-1.5" /> New test</>}
            </Button>
          </div>
        ) : (
          <Button onClick={submit} disabled={busy} data-testid="listening-submit-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answers"}
          </Button>
        )}
      </div>
    </div>
  );
}
