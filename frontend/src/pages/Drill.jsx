import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Flame, Trophy, BookOpenCheck, Headphones, Mic, Wrench, CheckCircle2, XCircle, Play, Pause, Lightbulb, ArrowRight, RotateCw } from "lucide-react";
import { toast } from "sonner";

const ICONS = { vocab: BookOpenCheck, listen: Headphones, speak: Mic, grammar: Wrench };
const TINTS = { vocab: "#E07A5F", listen: "#E9C46A", speak: "#2D6A4F", grammar: "#4A5550" };

export default function Drill() {
  const [drill, setDrill] = useState(null);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([api.get("/drill/today"), api.get("/drill/streak")]);
      setDrill(d.data);
      setStreak(s.data);
    } catch (e) {
      toast.error("Failed to load today's drill");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const completeItem = async (idx, result) => {
    try {
      const { data } = await api.post("/drill/complete-item", { drill_id: drill.id, item_index: idx, result });
      setDrill(data);
      const s = await api.get("/drill/streak");
      setStreak(s.data);
      if (data.completed) {
        toast.success(`Drill complete! +50 XP · ${s.data.streak_days}-day streak 🔥`);
      } else {
        toast.success("+25 XP");
      }
      setActiveIdx(null);
    } catch (e) {
      toast.error("Failed to save progress");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#8A958F]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading today's drill…
      </div>
    );
  }

  if (!drill) return null;

  const items = drill.items || [];
  const done = drill.completed_items || [];
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  const activeItem = activeIdx !== null ? items[activeIdx] : null;

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="drill-page">
      {/* Streak header */}
      <header className="bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] text-white rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/70">Today's drill</div>
            <h1 className="font-serif-display text-2xl sm:text-3xl mt-1">{drill.title}</h1>
            <p className="text-xs sm:text-sm text-white/80 mt-1">~{drill.estimated_minutes} min · Focus: <span className="text-[#E9C46A]">{drill.focus_area}</span></p>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Flame className="h-5 w-5 text-[#E9C46A]" />
                <span className="font-serif-display text-2xl sm:text-3xl">{streak?.streak_days ?? 0}</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">streak</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Trophy className="h-5 w-5 text-[#E9C46A]" />
                <span className="font-serif-display text-2xl sm:text-3xl">{streak?.total_xp ?? 0}</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">xp</div>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-5">
          <div className="flex justify-between text-xs text-white/70 mb-1.5">
            <span>{done.length} of {items.length} done</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-[#E9C46A] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {drill.completed && (
          <div className="mt-4 inline-flex items-center gap-1.5 bg-[#E9C46A]/20 text-[#E9C46A] px-3 py-1 rounded-full text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed today — come back tomorrow
          </div>
        )}
      </header>

      {/* Item list */}
      {activeItem === null && (
        <div className="space-y-3">
          {items.map((item, i) => {
            const Icon = ICONS[item.type] || BookOpenCheck;
            const tint = TINTS[item.type] || "#4A5550";
            const isDone = done.includes(i);
            return (
              <button
                key={i}
                data-testid={`drill-item-${i}`}
                onClick={() => setActiveIdx(i)}
                className={`w-full text-left bg-white border rounded-2xl p-4 sm:p-5 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${isDone ? "border-[#2D6A4F]/40 bg-[#E8EFE9]/40" : "border-[#E5E2DC]"}`}
              >
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint + "22", color: tint }}>
                  {isDone ? <CheckCircle2 className="h-5 w-5 text-[#2D6A4F]" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-[#8A958F]">{item.type} · {item.minutes} min</div>
                  <div className="font-serif-display text-base sm:text-lg mt-0.5 truncate">{item.title}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#8A958F]" />
              </button>
            );
          })}
          <Button onClick={load} variant="ghost" size="sm" className="text-xs text-[#8A958F]" data-testid="drill-refresh">
            <RotateCw className="h-3 w-3 mr-1" /> Reload
          </Button>
        </div>
      )}

      {/* Active item viewer */}
      {activeItem && (
        <ItemViewer
          item={activeItem}
          index={activeIdx}
          isDone={done.includes(activeIdx)}
          onBack={() => setActiveIdx(null)}
          onComplete={completeItem}
        />
      )}
    </div>
  );
}

function ItemViewer({ item, index, isDone, onBack, onComplete }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-[#2D6A4F]" data-testid="drill-back-btn">← All items</button>
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6">
        <div className="text-[10px] uppercase tracking-widest text-[#8A958F]">{item.type}</div>
        <h2 className="font-serif-display text-2xl mt-1">{item.title}</h2>
        <div className="mt-5">
          {item.type === "vocab" && <VocabItem item={item} isDone={isDone} onComplete={(r) => onComplete(index, r)} />}
          {item.type === "listen" && <ListenItem item={item} isDone={isDone} onComplete={(r) => onComplete(index, r)} />}
          {item.type === "speak" && <SpeakItem item={item} isDone={isDone} onComplete={(r) => onComplete(index, r)} />}
          {item.type === "grammar" && <GrammarItem item={item} isDone={isDone} onComplete={(r) => onComplete(index, r)} />}
        </div>
      </div>
    </div>
  );
}

function VocabItem({ item, isDone, onComplete }) {
  const cards = item.data?.cards || [];
  const [reviewed, setReviewed] = useState({});
  const allReviewed = cards.length > 0 && cards.every((_, i) => reviewed[i]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8A958F]">Theme: {item.data?.theme}</p>
      {cards.map((c, i) => (
        <details key={i} open={!!reviewed[i]} onToggle={(e) => e.target.open && setReviewed((r) => ({ ...r, [i]: true }))} className="bg-[#F0ECE4] rounded-xl p-4" data-testid={`drill-vocab-card-${i}`}>
          <summary className="cursor-pointer flex items-center justify-between gap-3">
            <span>
              <span className="font-serif-display text-lg text-[#1A201C]">{c.word}</span>
              <span className="text-xs text-[#8A958F] ml-2">{c.pos} · {c.ipa}</span>
            </span>
            {reviewed[i] && <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" />}
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <div className="text-[#1A201C]">{c.definition}</div>
            <div className="italic text-[#4A5550]">"{c.example}"</div>
            {c.synonyms?.length > 0 && <div className="text-xs text-[#8A958F]">Synonyms: {c.synonyms.join(", ")}</div>}
            {c.ielts_tip && (
              <div className="text-xs flex gap-1.5 items-start text-[#1A201C]"><Lightbulb className="h-3.5 w-3.5 mt-0.5 text-[#E9C46A] shrink-0" />{c.ielts_tip}</div>
            )}
          </div>
        </details>
      ))}
      <Button disabled={!allReviewed || isDone} onClick={() => onComplete({ reviewed: cards.length })} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11 mt-2" data-testid="drill-vocab-done">
        {isDone ? "Already done" : allReviewed ? "Mark as done · +25 XP" : `Open all ${cards.length} cards to continue`}
      </Button>
    </div>
  );
}

function ListenItem({ item, isDone, onComplete }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (playing && audioRef.current) { audioRef.current.pause(); setPlaying(false); return; }
    if (!url) {
      setLoading(true);
      try {
        const res = await api.post("/tts", { text: item.data?.script || "", voice: "nova" }, { responseType: "blob" });
        const u = URL.createObjectURL(res.data);
        setUrl(u);
        audioRef.current.src = u;
      } catch (e) {
        toast.error("Audio failed"); setLoading(false); return;
      }
      setLoading(false);
    }
    audioRef.current.onended = () => setPlaying(false);
    audioRef.current.play();
    setPlaying(true);
  };

  const questions = item.data?.questions || [];
  const setAns = (qn, v) => setAnswers((a) => ({ ...a, [String(qn)]: v }));

  const submit = () => {
    let correct = 0;
    const review = questions.map((q) => {
      const user = (answers[String(q.q_number)] || "").trim().toLowerCase();
      const truth = String(q.answer).trim().toLowerCase();
      const ok = user === truth || (truth.length > 3 && truth.includes(user) && user);
      if (ok) correct++;
      return { ...q, your_answer: answers[String(q.q_number)] || "", is_correct: ok };
    });
    setResult({ correct, total: questions.length, review });
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} className="hidden" />
      <Button onClick={play} disabled={loading} variant="outline" className="rounded-full" data-testid="drill-listen-play">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : playing ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
        {playing ? "Pause" : url ? "Replay" : "Play 60-second clip"}
      </Button>
      <div className="space-y-3">
        {questions.map((q) => {
          const r = result?.review?.find((rr) => rr.q_number === q.q_number);
          return (
            <div key={q.q_number} className="text-sm" data-testid={`drill-listen-q-${q.q_number}`}>
              <div className="mb-2"><span className="text-[#8A958F] mr-2">{q.q_number}.</span>{q.question}</div>
              {q.options ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const letter = opt.match(/^[A-Z]\b/)?.[0] || opt;
                    const v = letter.length === 1 ? letter : opt;
                    const sel = answers[String(q.q_number)] === v;
                    return <button key={opt} disabled={!!result} onClick={() => setAns(q.q_number, v)} className={`px-3 py-1.5 rounded-full text-xs border ${sel ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "bg-white border-[#E5E2DC]"}`}>{opt}</button>;
                  })}
                </div>
              ) : (
                <Input disabled={!!result} value={answers[String(q.q_number)] || ""} onChange={(e) => setAns(q.q_number, e.target.value)} placeholder="Answer" className="max-w-xs" />
              )}
              {r && (
                <div className="mt-2 space-y-1.5">
                  <div className={`text-xs flex items-center gap-1.5 ${r.is_correct ? "text-[#2D6A4F]" : "text-[#E07A5F]"}`}>
                    {r.is_correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Correct: <span className="font-medium">{r.correct_answer}</span>
                  </div>
                  {r.explanation && <div className="bg-[#F0ECE4] rounded-lg p-3 text-xs leading-relaxed flex gap-2"><Lightbulb className="h-3.5 w-3.5 mt-0.5 text-[#E9C46A] shrink-0" /> {r.explanation}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!result ? (
        <Button onClick={submit} disabled={Object.keys(answers).length < questions.length} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11" data-testid="drill-listen-submit">Submit answers</Button>
      ) : (
        <Button disabled={isDone} onClick={() => onComplete({ correct: result.correct, total: result.total })} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11" data-testid="drill-listen-done">
          {isDone ? "Already done" : `Score ${result.correct}/${result.total} · Mark as done · +25 XP`}
        </Button>
      )}
    </div>
  );
}

function SpeakItem({ item, isDone, onComplete }) {
  const [showModel, setShowModel] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const start = () => {
    setSeconds(0);
    setRunning(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stop = () => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  return (
    <div className="space-y-4">
      <div className="bg-[#F0ECE4] rounded-xl p-5">
        <div className="text-xs uppercase tracking-widest text-[#8A958F]">Speaking prompt</div>
        <div className="font-serif-display text-xl mt-2 text-[#1A201C]">{item.data?.prompt}</div>
        <div className="text-xs text-[#8A958F] mt-2">Aim for ~{item.data?.expected_seconds || 60}s</div>
      </div>
      <div className="flex items-center gap-3">
        {!running ? (
          <Button onClick={start} className="bg-[#E07A5F] hover:bg-[#C25B3F] text-white rounded-full" data-testid="drill-speak-start">Start 60-sec timer</Button>
        ) : (
          <Button onClick={stop} variant="outline" className="rounded-full" data-testid="drill-speak-stop">Stop</Button>
        )}
        <div className="font-mono text-2xl text-[#1A201C]" data-testid="drill-speak-timer">
          {Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}
        </div>
        <div className="text-xs text-[#8A958F]">Speak out loud — practising fluency.</div>
      </div>
      {item.data?.tips?.length > 0 && (
        <ul className="text-sm text-[#1A201C] space-y-1.5 list-disc pl-5">
          {item.data.tips.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
      <details onToggle={(e) => e.target.open && setShowModel(true)} className="bg-[#F9F8F6] rounded-xl p-4 border border-[#E5E2DC]">
        <summary className="cursor-pointer text-sm text-[#2D6A4F]" data-testid="drill-speak-model">Show band-8 model answer</summary>
        {showModel && <div className="mt-3 text-sm font-serif-display leading-relaxed whitespace-pre-wrap">{item.data?.model_answer}</div>}
      </details>
      <Button disabled={isDone || seconds < 20} onClick={() => onComplete({ seconds_spoken: seconds })} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11" data-testid="drill-speak-done">
        {isDone ? "Already done" : seconds < 20 ? `Speak at least 20s (${20 - seconds}s left)` : "Mark as done · +25 XP"}
      </Button>
    </div>
  );
}

function GrammarItem({ item, isDone, onComplete }) {
  const sentences = item.data?.sentences || [];
  const [shown, setShown] = useState({});
  const allShown = sentences.length > 0 && sentences.every((_, i) => shown[i]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#8A958F]">Focus: {item.data?.focus}</p>
      {sentences.map((s, i) => (
        <div key={i} className="bg-[#F0ECE4] rounded-xl p-4 space-y-2" data-testid={`drill-grammar-${i}`}>
          <div className="text-xs uppercase tracking-widest text-[#E07A5F]">Find the mistake</div>
          <div className="text-sm italic text-[#1A201C]">"{s.wrong}"</div>
          {shown[i] ? (
            <div className="space-y-1.5 pt-1 border-t border-[#E5E2DC]/60">
              <div className="text-sm text-[#2D6A4F] flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-1 shrink-0" /> {s.fixed}</div>
              {s.explanation && <div className="text-xs text-[#4A5550] flex items-start gap-2"><Lightbulb className="h-3.5 w-3.5 mt-0.5 text-[#E9C46A] shrink-0" /> {s.explanation}</div>}
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShown((sh) => ({ ...sh, [i]: true }))} className="rounded-full text-xs" data-testid={`drill-grammar-reveal-${i}`}>Reveal answer</Button>
          )}
        </div>
      ))}
      <Button disabled={!allShown || isDone} onClick={() => onComplete({ reviewed: sentences.length })} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-full h-11" data-testid="drill-grammar-done">
        {isDone ? "Already done" : allShown ? "Mark as done · +25 XP" : "Reveal all to continue"}
      </Button>
    </div>
  );
}
