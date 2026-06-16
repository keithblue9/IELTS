import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Headphones, Loader2, Play, Pause, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Listening() {
  const [tests, setTests] = useState([]);
  const [active, setActive] = useState(null); // full test
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [playingSec, setPlayingSec] = useState(null);
  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({}); // sectionIdx -> blob url

  useEffect(() => { api.get("/listening/tests").then((r) => setTests(r.data)); }, []);

  const openTest = async (id) => {
    setResult(null); setAnswers({}); setAudioCache({});
    const { data } = await api.get(`/listening/tests/${id}`);
    setActive(data);
  };

  const generateTest = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/listening/generate?topic_hint=${encodeURIComponent(topic || "general")}`);
      const refreshed = await api.get("/listening/tests");
      setTests(refreshed.data);
      setActive(data);
      setAnswers({});
      setResult(null);
      toast.success("New test generated!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Generation failed");
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
    } catch (e) {
      toast.error("Failed to submit");
    } finally { setBusy(false); }
  };

  if (!active) {
    return (
      <div className="space-y-8" data-testid="listening-page">
        <header>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">IELTS · Listening</div>
          <h1 className="font-serif-display text-4xl mt-2">Train your ears</h1>
          <p className="text-[#4A5550] mt-3 max-w-2xl">Four sections, 40 questions, narrated by an AI voice. Mix of multiple choice and short answer — just like the real test.</p>
        </header>
        <Card className="p-6 border-[#E5E2DC]">
          <h3 className="font-serif-display text-xl">Generate a new test</h3>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Input data-testid="listening-topic-input" placeholder="Optional theme (e.g. travel, university orientation)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <Button onClick={generateTest} disabled={generating} data-testid="listening-generate-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate test"}
            </Button>
          </div>
        </Card>

        <section>
          <h3 className="font-serif-display text-2xl mb-4">Available tests</h3>
          {tests.length === 0 && <p className="text-[#8A958F]">No tests yet — generate your first one above.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((t) => (
              <button key={t.id} onClick={() => openTest(t.id)} data-testid={`listening-test-${t.id}`} className="text-left bg-white border border-[#E5E2DC] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all">
                <Headphones className="h-5 w-5 text-[#E9C46A]" />
                <div className="font-serif-display text-xl mt-3">{t.title}</div>
                <div className="text-xs text-[#8A958F] mt-1">{t.sections?.length || 4} sections · {new Date(t.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="listening-active">
      <button onClick={() => setActive(null)} className="text-sm text-[#2D6A4F]">← Back to tests</button>
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Listening test</div>
        <h1 className="font-serif-display text-3xl mt-1">{active.title}</h1>
      </header>
      <audio ref={audioRef} className="hidden" />

      <div className="space-y-6">
        {active.sections?.map((sec, idx) => (
          <div key={idx} className="bg-white border border-[#E5E2DC] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Section {sec.section}</div>
                <h3 className="font-serif-display text-2xl mt-1">{sec.title}</h3>
              </div>
              <Button onClick={() => playSection(idx, sec.script)} data-testid={`listening-play-sec-${sec.section}`} variant="outline" className="rounded-full">
                {playingSec === idx ? <><Pause className="h-4 w-4 mr-2" /> Pause</> : <><Play className="h-4 w-4 mr-2" /> Play audio</>}
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {sec.questions?.map((q) => (
                <div key={q.q_number} className="text-sm" data-testid={`listening-q-${q.q_number}`}>
                  <div className="text-[#1A201C] mb-2"><span className="text-[#8A958F] mr-2">{q.q_number}.</span>{q.question}</div>
                  {q.options ? (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => {
                        const letter = opt.match(/^[A-Z]\b/)?.[0] || opt;
                        const value = letter.length === 1 ? letter : opt;
                        const active = answers[String(q.q_number)] === value;
                        return (
                          <button key={opt} onClick={() => setAns(q.q_number, value)} data-testid={`listening-q${q.q_number}-${value}`} className={`px-3 py-1.5 rounded-full text-xs border ${active ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "bg-white border-[#E5E2DC] text-[#1A201C]"}`}>{opt}</button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input data-testid={`listening-q${q.q_number}-input`} value={answers[String(q.q_number)] || ""} onChange={(e) => setAns(q.q_number, e.target.value)} placeholder="Type answer (max 3 words)" className="max-w-sm" />
                  )}
                  {result && (() => {
                    const r = result.review.find((rr) => rr.q_number === q.q_number);
                    if (!r) return null;
                    return <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${r.is_correct ? "text-[#2D6A4F]" : "text-[#E07A5F]"}`}>
                      {r.is_correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Correct: <span className="font-medium">{r.correct_answer}</span>
                    </div>;
                  })()}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 z-10 bg-white border border-[#E5E2DC] rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div className="text-sm">
          <span className="text-[#8A958F]">Answered </span>
          <span className="font-medium">{Object.keys(answers).length}</span>
          <span className="text-[#8A958F]"> / {active.sections?.reduce((s, sec) => s + sec.questions.length, 0)}</span>
        </div>
        {result ? (
          <div className="text-sm">
            <span className="font-serif-display text-2xl text-[#2D6A4F] mr-2">{result.band}</span>
            <span className="text-[#8A958F]">band ({result.correct}/{result.total})</span>
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
