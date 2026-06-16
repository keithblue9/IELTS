import { useEffect, useRef, useState } from "react";
import api, { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, Square, Play, History, Award, Loader2 } from "lucide-react";
import AIVoiceOrb from "@/components/AIVoiceOrb";
import { toast } from "sonner";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export default function Speaking() {
  const [tab, setTab] = useState("practice");
  const [topics, setTopics] = useState({ part1: [], part2: [], part3: [] });
  const [part, setPart] = useState(1);
  const [topic, setTopic] = useState("");
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cueCard, setCueCard] = useState(null);
  const [orbState, setOrbState] = useState("idle"); // idle | speaking | listening | thinking
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    api.get("/speaking/topics").then((r) => setTopics(r.data));
    api.get("/profile").then((r) => setProfile(r.data));
    api.get("/speaking/sessions").then((r) => setHistory(r.data));
  }, []);

  const playTTS = async (text) => {
    try {
      setOrbState("speaking");
      const res = await api.post("/tts", { text, voice: profile?.tutor_voice || "nova" }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.onended = () => setOrbState("idle");
        await audioRef.current.play();
      }
    } catch (e) {
      setOrbState("idle");
    }
  };

  const startSession = async () => {
    setBusy(true);
    setScore(null);
    setMessages([]);
    setCueCard(null);
    try {
      const { data } = await api.post("/speaking/start", { part, topic: topic || null });
      setSession({ id: data.session_id, part: data.part, topic: data.topic });
      setMessages([{ role: "assistant", content: data.spoken }]);
      if (data.cue_card) setCueCard(data.cue_card);
      await playTTS(data.spoken);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start session");
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!session) { toast.error("Start a session first"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMime() });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await processRecording();
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setOrbState("listening");
    } catch (e) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && recording) {
      mediaRef.current.stop();
      setRecording(false);
      setOrbState("thinking");
    }
  };

  const processRecording = async () => {
    const mime = chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    if (blob.size < 1000) {
      toast.error("Audio too short, try again");
      setOrbState("idle");
      return;
    }
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const fd = new FormData();
    fd.append("file", blob, `speech.${ext}`);
    try {
      const stt = await api.post("/stt", fd);
      const transcript = stt.data.text?.trim();
      if (!transcript) { toast.error("Couldn't hear you, try again."); setOrbState("idle"); return; }
      setMessages((m) => [...m, { role: "user", content: transcript }]);

      const reply = await api.post("/speaking/turn", { session_id: session.id, user_text: transcript });
      const replyText = reply.data.reply;
      setMessages((m) => [...m, { role: "assistant", content: replyText }]);
      await playTTS(replyText);
    } catch (e) {
      toast.error("Something went wrong, please retry");
      setOrbState("idle");
    }
  };

  const finishSession = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const { data } = await api.post("/speaking/finish", { session_id: session.id });
      setScore(data.score);
      const refreshed = await api.get("/speaking/sessions");
      setHistory(refreshed.data);
      toast.success(`Session scored: Band ${data.score.overall_band}`);
    } catch (e) {
      toast.error("Failed to score session");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setSession(null); setMessages([]); setCueCard(null); setScore(null); setOrbState("idle");
  };

  return (
    <div className="space-y-8" data-testid="speaking-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">IELTS · Speaking</div>
        <h1 className="font-serif-display text-4xl mt-2">Talk with Aria, your AI examiner</h1>
        <p className="text-[#4A5550] mt-3 max-w-2xl">Full Part 1, 2 and 3 simulation. Speak into your microphone — Aria listens, replies, and grades you against IELTS public band descriptors at the end.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="practice" data-testid="speaking-tab-practice">Practice</TabsTrigger>
          <TabsTrigger value="history" data-testid="speaking-tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="practice" className="mt-6">
          {!session && (
            <Card className="p-8 border-[#E5E2DC]">
              <h3 className="font-serif-display text-2xl mb-6">Configure your test</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-[#4A5550]">Part</label>
                  <Select value={String(part)} onValueChange={(v) => { setPart(Number(v)); setTopic(""); }}>
                    <SelectTrigger className="mt-1.5" data-testid="speaking-part-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Part 1 — Familiar topics</SelectItem>
                      <SelectItem value="2">Part 2 — Long-turn (cue card)</SelectItem>
                      <SelectItem value="3">Part 3 — Discussion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-[#4A5550]">Topic (optional — random if blank)</label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger className="mt-1.5" data-testid="speaking-topic-select"><SelectValue placeholder="Random topic" /></SelectTrigger>
                    <SelectContent>
                      {(part === 1 ? topics.part1 : part === 2 ? topics.part2 : topics.part3).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={startSession} disabled={busy} data-testid="speaking-start-btn" className="mt-8 bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-6 h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start speaking session"}
              </Button>
            </Card>
          )}

          {session && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Orb + controls */}
              <div className="lg:col-span-5 bg-white border border-[#E5E2DC] rounded-2xl p-8 flex flex-col items-center grain-bg">
                <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Part {session.part} · {session.topic}</div>
                <div className="my-6"><AIVoiceOrb state={orbState} size={240} /></div>
                <div className="text-sm text-[#4A5550] mb-6 capitalize">{orbState === "thinking" ? "Aria is thinking…" : orbState === "speaking" ? "Aria is speaking" : orbState === "listening" ? "Listening to you…" : "Tap mic to reply"}</div>
                <div className="flex items-center gap-3">
                  {!recording ? (
                    <Button onClick={startRecording} data-testid="speaking-mic-start" disabled={orbState === "speaking" || orbState === "thinking"} className="bg-[#E07A5F] hover:bg-[#C25B3F] text-white rounded-full h-14 w-14 p-0">
                      <Mic className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} data-testid="speaking-mic-stop" className="bg-[#1A201C] hover:bg-black text-white rounded-full h-14 w-14 p-0">
                      <Square className="h-4 w-4 fill-white" />
                    </Button>
                  )}
                  <Button onClick={finishSession} data-testid="speaking-finish-btn" variant="outline" className="rounded-full border-[#1A201C]/15">
                    <Award className="h-4 w-4 mr-2" /> Finish & score
                  </Button>
                  <Button onClick={resetAll} variant="ghost" data-testid="speaking-reset-btn">New</Button>
                </div>
                <audio ref={audioRef} className="hidden" />
                {cueCard && (
                  <div className="mt-8 bg-[#F0ECE4] rounded-xl p-5 w-full">
                    <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-2">Cue card</div>
                    <pre className="whitespace-pre-wrap text-sm text-[#1A201C] font-sans leading-relaxed">{cueCard}</pre>
                  </div>
                )}
              </div>

              {/* Transcript + score */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 max-h-[60vh] overflow-y-auto" data-testid="speaking-transcript">
                  <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-4">Transcript</div>
                  <div className="space-y-4">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-[#F0ECE4] text-[#1A201C]" : "bg-transparent"}`}>
                          {m.role === "assistant" && (
                            <div className="text-[10px] uppercase tracking-widest text-[#8A958F] mb-1">Aria</div>
                          )}
                          <div className={`${m.role === "assistant" ? "font-serif-display text-lg leading-snug" : "text-sm"}`}>{m.content}</div>
                          {m.role === "assistant" && (
                            <button onClick={() => playTTS(m.content)} className="mt-2 text-xs text-[#2D6A4F] inline-flex items-center gap-1 hover:underline" data-testid={`replay-${i}`}><Play className="h-3 w-3" /> Replay</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {score && <ScoreCard score={score} />}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {history.length === 0 && <p className="text-[#8A958F]">No sessions yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((h) => (
              <div key={h.id} className="bg-white border border-[#E5E2DC] rounded-2xl p-5" data-testid={`history-session-${h.id}`}>
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Part {h.part} · {new Date(h.created_at).toLocaleDateString()}</div>
                <div className="font-serif-display text-xl mt-1">{h.topic}</div>
                {h.score ? (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="font-serif-display text-3xl text-[#2D6A4F]">{h.score.overall_band}</span>
                    <span className="text-xs text-[#8A958F]">overall band</span>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-[#8A958F]">Not scored</div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getSupportedMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

function ScoreCard({ score }) {
  const radar = [
    { skill: "Fluency", band: score.criteria?.fluency || 0 },
    { skill: "Lexical", band: score.criteria?.lexical || 0 },
    { skill: "Grammar", band: score.criteria?.grammar || 0 },
    { skill: "Pronunciation", band: score.criteria?.pronunciation || 0 },
  ];
  return (
    <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 animate-fade-in-up" data-testid="speaking-score-card">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex items-center gap-6">
          <div className="relative h-32 w-32">
            <svg className="absolute inset-0" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="#E5E2DC" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="44" stroke="#2D6A4F" strokeWidth="8" fill="none"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - (score.overall_band || 0) / 9)}
                strokeLinecap="round"
                transform="rotate(-90 50 50)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-serif-display text-3xl text-[#2D6A4F]">{score.overall_band}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8A958F]">overall</div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-[#8A958F]">Result</div>
            <div className="font-serif-display text-2xl">Band {score.overall_band}</div>
            <div className="text-xs text-[#8A958F] mt-1">based on IELTS public descriptors</div>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar}>
              <PolarGrid stroke="#E5E2DC" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: "#4A5550", fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fill: "#8A958F", fontSize: 9 }} />
              <Radar dataKey="band" stroke="#E07A5F" fill="#E07A5F" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {score.strengths?.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-2">Strengths</div>
            <ul className="space-y-1.5 list-disc pl-5 text-[#1A201C]">{score.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-2">To improve</div>
            <ul className="space-y-1.5 list-disc pl-5 text-[#1A201C]">{(score.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        </div>
      )}
      {score.tip_of_the_day && (
        <div className="mt-6 bg-[#F0ECE4] rounded-xl p-4 text-sm">
          <div className="text-xs uppercase tracking-widest text-[#8A958F] mb-1">Tip of the day</div>
          <div className="font-serif-display text-lg">{score.tip_of_the_day}</div>
        </div>
      )}
      {score.model_answer && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-[#2D6A4F]">View band-8 model answer</summary>
          <div className="mt-2 text-sm bg-[#F9F8F6] rounded-lg p-4 leading-relaxed whitespace-pre-wrap">{score.model_answer}</div>
        </details>
      )}
    </div>
  );
}
