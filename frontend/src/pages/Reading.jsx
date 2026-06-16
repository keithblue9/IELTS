import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BookOpen, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Reading() {
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api.get("/reading/passages").then((r) => setList(r.data)); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/reading/generate?topic_hint=${encodeURIComponent(topic || "science and society")}`);
      const refreshed = await api.get("/reading/passages");
      setList(refreshed.data);
      setActive(data); setAnswers({}); setResult(null);
      toast.success("Reading passage generated");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Generation failed");
    } finally { setGenerating(false); }
  };

  const open = async (id) => {
    const { data } = await api.get(`/reading/passages/${id}`);
    setActive(data); setAnswers({}); setResult(null);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/reading/submit", { passage_id: active.id, answers });
      setResult(data);
      toast.success(`Band ${data.band} · ${data.correct}/${data.total}`);
    } catch (e) {
      toast.error("Failed to submit");
    } finally { setBusy(false); }
  };

  if (!active) {
    return (
      <div className="space-y-8" data-testid="reading-page">
        <header>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">IELTS · Reading</div>
          <h1 className="font-serif-display text-4xl mt-2">Academic passages, instantly graded</h1>
          <p className="text-[#4A5550] mt-3 max-w-2xl">True / False / Not Given, multiple choice and short answer. Generate fresh passages on any topic.</p>
        </header>
        <Card className="p-6 border-[#E5E2DC]">
          <h3 className="font-serif-display text-xl">Generate a new passage</h3>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Input data-testid="reading-topic-input" placeholder="Theme (e.g., renewable energy, ancient civilisations)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <Button onClick={generate} disabled={generating} data-testid="reading-generate-btn" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full px-6 h-11">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </Card>

        <section>
          <h3 className="font-serif-display text-2xl mb-4">Available passages</h3>
          {list.length === 0 && <p className="text-[#8A958F]">No passages yet — generate one above.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((p) => (
              <button key={p.id} onClick={() => open(p.id)} data-testid={`reading-passage-${p.id}`} className="text-left bg-white border border-[#E5E2DC] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all">
                <BookOpen className="h-5 w-5 text-[#1A201C]" />
                <div className="font-serif-display text-xl mt-3">{p.title}</div>
                <div className="text-xs text-[#8A958F] mt-1">{p.questions?.length || 10} questions · {new Date(p.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reading-active">
      <button onClick={() => setActive(null)} className="text-sm text-[#2D6A4F]">← Back to passages</button>
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Reading passage</div>
        <h1 className="font-serif-display text-3xl mt-1">{active.title}</h1>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5E2DC] rounded-2xl p-6 max-h-[75vh] overflow-y-auto">
          <div className="font-serif-display text-base leading-loose whitespace-pre-wrap">{active.passage}</div>
        </div>
        <div className="lg:col-span-5 space-y-3">
          {active.questions?.map((q) => (
            <div key={q.q_number} className="bg-white border border-[#E5E2DC] rounded-xl p-4 text-sm" data-testid={`reading-q-${q.q_number}`}>
              <div className="mb-2"><span className="text-[#8A958F] mr-2">{q.q_number}.</span>{q.question}</div>
              {q.options ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const letter = opt.match(/^[A-Z]\b/)?.[0] || opt;
                    const value = letter.length === 1 ? letter : opt;
                    const active = answers[String(q.q_number)] === value;
                    return <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [String(q.q_number)]: value }))} data-testid={`reading-q${q.q_number}-${value}`} className={`px-3 py-1.5 rounded-full text-xs border ${active ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "bg-white border-[#E5E2DC]"}`}>{opt}</button>;
                  })}
                </div>
              ) : (
                <Input data-testid={`reading-q${q.q_number}-input`} value={answers[String(q.q_number)] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [String(q.q_number)]: e.target.value }))} placeholder="Your answer" />
              )}
              {result && (() => {
                const r = result.review.find((rr) => rr.q_number === q.q_number);
                if (!r) return null;
                return <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${r.is_correct ? "text-[#2D6A4F]" : "text-[#E07A5F]"}`}>{r.is_correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Correct: <span className="font-medium">{r.correct_answer}</span></div>;
              })()}
            </div>
          ))}
          {result ? (
            <div className="bg-[#F0ECE4] rounded-2xl p-5">
              <div className="text-xs uppercase tracking-widest text-[#8A958F]">Result</div>
              <div className="font-serif-display text-3xl text-[#2D6A4F] mt-1">Band {result.band}</div>
              <div className="text-xs text-[#8A958F]">{result.correct}/{result.total} correct</div>
            </div>
          ) : (
            <Button onClick={submit} disabled={busy} data-testid="reading-submit-btn" className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answers"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
