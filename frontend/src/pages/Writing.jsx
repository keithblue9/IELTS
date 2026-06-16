import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText, History } from "lucide-react";
import { toast } from "sonner";

export default function Writing() {
  const [task, setTask] = useState(1);
  const [prompts, setPrompts] = useState({ task1: [], task2: [] });
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("write");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get("/writing/prompts").then((r) => setPrompts(r.data));
    api.get("/writing/submissions").then((r) => setHistory(r.data));
  }, []);

  const list = task === 1 ? prompts.task1 : prompts.task2;
  const promptObj = list.find((p) => p.id === selectedPrompt);
  const finalPrompt = customPrompt.trim() || (promptObj ? promptObj.prompt : "");
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minWords = task === 1 ? 150 : 250;

  const submit = async () => {
    if (!finalPrompt) { toast.error("Pick a prompt or enter your own"); return; }
    if (wordCount < 30) { toast.error("Write at least 30 words"); return; }
    setBusy(true); setResult(null);
    try {
      const { data } = await api.post("/writing/submit", { task, prompt: finalPrompt, response_text: text });
      setResult(data);
      const refreshed = await api.get("/writing/submissions");
      setHistory(refreshed.data);
      toast.success(`Scored: Band ${data.score.overall_band}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Scoring failed");
    } finally { setBusy(false); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/writing/upload", fd);
      setText(data.text);
      toast.success(`Extracted ${data.word_count} words from ${file.name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to read file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-8" data-testid="writing-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">IELTS · Writing</div>
        <h1 className="font-serif-display text-4xl mt-2">Write. Submit. Get your band.</h1>
        <p className="text-[#4A5550] mt-3 max-w-2xl">Task 1 (data description / letter) or Task 2 (essay). Upload a .docx, .pdf, .txt, or paste your text. Aria scores against all four IELTS Writing criteria and shows you a model band-8 answer.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="write" data-testid="writing-tab-write">Write</TabsTrigger>
          <TabsTrigger value="history" data-testid="writing-tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-[#E5E2DC] rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button data-testid="writing-task1-btn" onClick={() => { setTask(1); setSelectedPrompt(""); }} className={`px-4 py-1.5 rounded-full text-sm ${task === 1 ? "bg-[#2D6A4F] text-white" : "bg-[#F0ECE4] text-[#1A201C]"}`}>Task 1</button>
                <button data-testid="writing-task2-btn" onClick={() => { setTask(2); setSelectedPrompt(""); }} className={`px-4 py-1.5 rounded-full text-sm ${task === 2 ? "bg-[#2D6A4F] text-white" : "bg-[#F0ECE4] text-[#1A201C]"}`}>Task 2</button>
              </div>
              <div className="text-xs text-[#8A958F]">Min {minWords} words</div>
            </div>

            <div className="mt-5">
              <label className="text-sm text-[#4A5550]">Choose a prompt</label>
              <Select value={selectedPrompt} onValueChange={(v) => { setSelectedPrompt(v); setCustomPrompt(""); }}>
                <SelectTrigger className="mt-1.5" data-testid="writing-prompt-select"><SelectValue placeholder="Select a prompt..." /></SelectTrigger>
                <SelectContent>
                  {list.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {promptObj && (
                <div className="mt-3 bg-[#F0ECE4] rounded-lg p-4 text-sm leading-relaxed text-[#1A201C]">{promptObj.prompt}</div>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[#2D6A4F]">Or enter your own prompt</summary>
                <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Paste your own prompt here" className="mt-2" data-testid="writing-custom-prompt" />
              </details>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#4A5550]">Your response</label>
                <label className="cursor-pointer text-sm text-[#2D6A4F] inline-flex items-center gap-1.5 hover:underline">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload .docx / .pdf
                  <input data-testid="writing-upload-input" type="file" accept=".docx,.pdf,.txt" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              <Textarea
                data-testid="writing-response-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={16}
                placeholder="Type your essay here, or upload a file..."
                className="mt-2 leading-loose font-serif-display text-base"
              />
              <div className="flex items-center justify-between text-xs text-[#8A958F] mt-2">
                <span>{wordCount} words {wordCount < minWords && `(${minWords - wordCount} short of recommended)`}</span>
                <span>{task === 1 ? "Task 1 · 20 min" : "Task 2 · 40 min"}</span>
              </div>
            </div>

            <Button onClick={submit} disabled={busy} data-testid="writing-submit-btn" className="mt-6 bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-6 h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Score my writing"}
            </Button>
          </div>

          <div className="lg:col-span-5">
            {result ? <WritingScoreCard result={result} /> : (
              <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6">
                <FileText className="h-6 w-6 text-[#E07A5F]" />
                <h3 className="font-serif-display text-2xl mt-3">How scoring works</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#4A5550]">
                  <li>· Task Achievement / Response — did you address the prompt fully?</li>
                  <li>· Coherence & Cohesion — flow, paragraphing, linking words.</li>
                  <li>· Lexical Resource — vocabulary range and accuracy.</li>
                  <li>· Grammatical Range & Accuracy — structures and error-free sentences.</li>
                </ul>
                <div className="mt-6 bg-[#F0ECE4] rounded-lg p-4 text-xs text-[#4A5550]">
                  Final band is averaged across the 4 criteria, in 0.5 increments. Aria also gives you sentence-level annotated feedback and a model band-8 answer.
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {history.length === 0 && <p className="text-[#8A958F]">No submissions yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((h) => (
              <div key={h.id} className="bg-white border border-[#E5E2DC] rounded-2xl p-5" data-testid={`writing-history-${h.id}`}>
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Task {h.task} · {new Date(h.created_at).toLocaleDateString()}</div>
                <div className="font-serif-display text-lg mt-1 line-clamp-2">{h.prompt}</div>
                {h.score && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="font-serif-display text-3xl text-[#2D6A4F]">{h.score.overall_band}</span>
                    <span className="text-xs text-[#8A958F]">{h.word_count} words</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WritingScoreCard({ result }) {
  const c = result.score.criteria || {};
  const criteria = [
    { name: "Task Achievement", v: c.task_achievement || 0 },
    { name: "Coherence", v: c.coherence_cohesion || 0 },
    { name: "Lexical Resource", v: c.lexical_resource || 0 },
    { name: "Grammar", v: c.grammar_accuracy || 0 },
  ];
  return (
    <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 animate-fade-in-up" data-testid="writing-score-card">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28">
          <svg className="absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" stroke="#E5E2DC" strokeWidth="8" fill="none" />
            <circle cx="50" cy="50" r="44" stroke="#2D6A4F" strokeWidth="8" fill="none"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - (result.score.overall_band || 0) / 9)}
              strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-serif-display text-2xl text-[#2D6A4F]">{result.score.overall_band}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#8A958F]">band</div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {criteria.map((cr) => (
            <div key={cr.name} className="text-sm">
              <div className="flex justify-between mb-1"><span className="text-[#4A5550]">{cr.name}</span><span className="text-[#1A201C] font-medium">{cr.v}</span></div>
              <div className="h-1.5 bg-[#E5E2DC] rounded-full overflow-hidden">
                <div className="h-full bg-[#E07A5F]" style={{ width: `${(cr.v / 9) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {(result.score.strengths?.length > 0 || result.score.improvements?.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-4 text-sm">
          {result.score.strengths?.length > 0 && (
            <div><div className="text-xs uppercase tracking-widest text-[#8A958F] mb-1.5">Strengths</div><ul className="list-disc pl-5 space-y-1">{result.score.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          )}
          {result.score.improvements?.length > 0 && (
            <div><div className="text-xs uppercase tracking-widest text-[#8A958F] mb-1.5">To improve</div><ul className="list-disc pl-5 space-y-1">{result.score.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          )}
        </div>
      )}
      {result.score.annotated_feedback?.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-2">Annotated feedback</div>
          <div className="space-y-3">
            {result.score.annotated_feedback.map((f, i) => (
              <div key={i} className="bg-[#F0ECE4] rounded-lg p-3 text-sm">
                <div className="text-xs text-[#E07A5F] uppercase tracking-widest">{f.issue}</div>
                <blockquote className="mt-1 italic font-serif-display">"{f.excerpt}"</blockquote>
                <div className="mt-1 text-[#4A5550]">{f.comment}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.score.model_answer && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-[#2D6A4F]">View band-8 model answer</summary>
          <div className="mt-2 bg-[#F9F8F6] rounded-lg p-4 text-sm leading-loose font-serif-display whitespace-pre-wrap">{result.score.model_answer}</div>
        </details>
      )}
    </div>
  );
}
