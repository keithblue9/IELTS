import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Download, RefreshCw, Smartphone, Quote, BookOpenCheck, AlertTriangle, Target, History } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";

export default function Recap() {
  const [recap, setRecap] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const printableRef = useRef(null);
  const wallpaperRef = useRef(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get("/recap/this-week");
      setRecap(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load recap");
    } finally { setLoading(false); }
    api.get("/recap/history").then((r) => setHistory(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const regenerate = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/recap/regenerate");
      setRecap(r.data);
      const h = await api.get("/recap/history");
      setHistory(h.data);
      toast.success("New recap ready");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Regeneration failed");
    } finally { setGenerating(false); }
  };

  const downloadPDF = () => {
    if (typeof window !== "undefined") window.print();
  };

  const downloadPNG = async (ref, fileName) => {
    if (!ref.current) return;
    try {
      toast.message("Rendering image…");
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#1A201C",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Saved");
    } catch (e) {
      toast.error("Image export failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#8A958F]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Building your recap…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="recap-empty">
        <header>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Weekly Recap</div>
          <h1 className="font-serif-display text-3xl sm:text-4xl mt-2">Not enough activity yet</h1>
          <p className="text-sm text-[#4A5550] mt-3 max-w-xl">Complete at least one drill, writing, speaking, or listening session this week and your recap will appear here.</p>
        </header>
        <Button onClick={load} variant="outline" className="rounded-full">Try again</Button>
      </div>
    );
  }

  if (!recap) return null;

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="recap-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Weekly Recap · {recap.week_label}</div>
          <h1 className="font-serif-display text-3xl sm:text-4xl mt-2">{recap.title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={regenerate} disabled={generating} variant="outline" size="sm" className="rounded-full" data-testid="recap-regen-btn">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />} Regenerate
          </Button>
          <Button onClick={downloadPDF} variant="outline" size="sm" className="rounded-full" data-testid="recap-pdf-btn">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Printable area */}
      <div ref={printableRef} className="bg-white border border-[#E5E2DC] rounded-2xl p-6 sm:p-10 space-y-6 print:border-0 print:p-0">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#E07A5F]">
          <Sparkles className="h-3.5 w-3.5" /> Headline
        </div>
        <p className="font-serif-display text-2xl sm:text-3xl leading-snug text-[#1A201C]">{recap.headline}</p>

        <div className="prose prose-stone max-w-none font-serif-display text-base sm:text-lg leading-relaxed text-[#1A201C] whitespace-pre-wrap" data-testid="recap-essay">
          {recap.essay}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E5E2DC]">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#E07A5F] mb-3">
              <AlertTriangle className="h-3.5 w-3.5" /> Common errors
            </div>
            <ul className="space-y-3" data-testid="recap-errors">
              {(recap.common_errors || []).map((e, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium text-[#1A201C]">{e.pattern}</div>
                  <div className="italic text-[#4A5550] mt-0.5">"{e.example}"</div>
                  <div className="text-xs text-[#2D6A4F] mt-0.5">{e.fix}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#2D6A4F] mb-3">
              <BookOpenCheck className="h-3.5 w-3.5" /> Top vocab to retain
            </div>
            <ul className="space-y-3" data-testid="recap-vocab">
              {(recap.top_vocab || []).map((v, i) => (
                <li key={i} className="text-sm">
                  <div className="font-serif-display text-base text-[#1A201C]">{v.word}</div>
                  <div className="text-xs text-[#4A5550]">{v.definition}</div>
                  <div className="text-xs italic text-[#4A5550] mt-0.5">"{v.example}"</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#8A958F] mt-0.5">{v.best_used_in}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {recap.next_week_focus && (
          <div className="pt-4 border-t border-[#E5E2DC] flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#E8EFE9] flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-[#2D6A4F]" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8A958F]">Next week, focus on</div>
              <div className="font-serif-display text-xl text-[#2D6A4F] mt-0.5">{recap.next_week_focus}</div>
            </div>
          </div>
        )}
      </div>

      {/* Wallpaper card */}
      {recap.wallpaper_quote && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8A958F]">
              <Smartphone className="h-3.5 w-3.5" /> Lock-screen wallpaper
            </div>
            <Button onClick={() => downloadPNG(wallpaperRef, `ascent-week-${recap.week_str}.png`)} variant="outline" size="sm" className="rounded-full" data-testid="recap-wallpaper-btn">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Save PNG
            </Button>
          </div>
          <div className="flex justify-center">
            <div
              ref={wallpaperRef}
              className="relative w-[270px] h-[480px] sm:w-[300px] sm:h-[540px] rounded-3xl overflow-hidden p-6 flex flex-col justify-between text-white"
              style={{
                background: "linear-gradient(160deg, #1A201C 0%, #1B4332 55%, #2D6A4F 100%)",
              }}
              data-testid="recap-wallpaper"
            >
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#E9C46A]">{recap.week_label}</div>
                <div className="font-serif-display text-2xl mt-2 leading-tight">{recap.title}</div>
              </div>
              <div className="space-y-3">
                <Quote className="h-7 w-7 text-[#E9C46A] opacity-80" />
                <div className="font-serif-display text-xl sm:text-2xl leading-snug">{recap.wallpaper_quote}</div>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Ascent IELTS</div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-white/50">next focus</div>
                  <div className="text-sm text-[#E9C46A]">{recap.next_week_focus || "Keep going"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 1 && (
        <section data-testid="recap-history">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8A958F] mb-3">
            <History className="h-3.5 w-3.5" /> Previous recaps
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.filter((h) => h.week_str !== recap.week_str).map((h) => (
              <Card key={h.id} className="p-4 border-[#E5E2DC]">
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">{h.week_label}</div>
                <div className="font-serif-display text-lg mt-1 line-clamp-1">{h.title}</div>
                <div className="text-xs text-[#4A5550] mt-1 line-clamp-2">{h.headline}</div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-testid="recap-page"] *, [data-testid="recap-page"] { visibility: visible; }
          [data-testid="recap-page"] { position: absolute; left: 0; top: 0; width: 100%; }
          [data-testid="recap-wallpaper"], [data-testid="recap-history"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
