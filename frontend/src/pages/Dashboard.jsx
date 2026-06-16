import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Mic, PenLine, Headphones, BookOpen, Flame, Target, Calendar, Sparkles, TrendingDown, TrendingUp, Zap, ArrowRight, Trophy } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [pain, setPain] = useState(null);
  const [drillStreak, setDrillStreak] = useState(null);

  useEffect(() => {
    api.get("/profile").then((r) => setProfile(r.data));
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/dashboard/pain-points").then((r) => setPain(r.data));
    api.get("/drill/streak").then((r) => setDrillStreak(r.data)).catch(() => {});
  }, []);

  const overall = stats?.overall_band ?? profile?.current_band ?? 0;
  const target = profile?.target_band ?? 7;
  const progressPct = Math.min(100, Math.round((overall / 9) * 100));

  const radarData = [
    { skill: "Speaking", band: stats?.bands?.speaking ?? 0, full: 9 },
    { skill: "Writing", band: stats?.bands?.writing ?? 0, full: 9 },
    { skill: "Listening", band: stats?.bands?.listening ?? 0, full: 9 },
    { skill: "Reading", band: 0, full: 9 },
  ];

  const history = (stats?.history || []).map((h) => ({
    date: h.date.slice(5, 10),
    band: h.band,
  }));

  return (
    <div className="space-y-8 sm:space-y-10" data-testid="dashboard-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Welcome back</div>
        <h1 className="font-serif-display text-3xl sm:text-5xl mt-2">Hello, {user?.name?.split(" ")[0] || "there"}.</h1>
        <p className="text-sm sm:text-base text-[#4A5550] mt-3 max-w-xl">Pick a skill and start training. Aria is ready when you are.</p>
      </header>

      {/* Daily Drill — hero card */}
      <button
        onClick={() => navigate("/app/drill")}
        data-testid="daily-drill-card"
        className="w-full text-left bg-gradient-to-br from-[#1A201C] via-[#1B4332] to-[#2D6A4F] text-white rounded-2xl p-5 sm:p-7 relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] bg-[#E9C46A]/15 text-[#E9C46A] border border-[#E9C46A]/30 rounded-full px-3 py-1 mb-3">
              <Zap className="h-3 w-3" /> Daily drill · ~8 min
            </div>
            <h2 className="font-serif-display text-2xl sm:text-3xl leading-tight">
              {drillStreak?.today_done
                ? "Nice — drill done today."
                : drillStreak?.streak_days > 0
                ? `Day ${drillStreak.streak_days + 1} of your streak`
                : "Start your daily IELTS routine"}
            </h2>
            <p className="text-sm text-white/75 mt-2">A 4-piece routine (vocab + listening + speaking + grammar) auto-calibrated to your weakest area. Built for busy days.</p>
          </div>
          <div className="md:col-span-5 flex items-center justify-between md:justify-end gap-5 sm:gap-7">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Flame className="h-5 w-5 text-[#E9C46A]" />
                <span className="font-serif-display text-3xl sm:text-4xl">{drillStreak?.streak_days ?? 0}</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">streak</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Trophy className="h-5 w-5 text-[#E9C46A]" />
                <span className="font-serif-display text-3xl sm:text-4xl">{drillStreak?.total_xp ?? 0}</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">xp</div>
            </div>
            <ArrowRight className="h-6 w-6 text-[#E9C46A]" />
          </div>
        </div>
      </button>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <BigStat icon={Target} label="Target" value={target.toFixed(1)} tint="#2D6A4F" sub={profile?.test_date ? `Test ${profile.test_date}` : "No date set"} />
        <BigStat icon={Sparkles} label="Estimated" value={overall ? Number(overall).toFixed(1) : "—"} tint="#E07A5F" sub={overall ? `${progressPct}% of 9` : "Take a session"} />
        <BigStat icon={Flame} label="Sessions" value={(stats?.counts?.speaking_sessions ?? 0) + (stats?.counts?.writing_submissions ?? 0) + (stats?.counts?.listening_attempts ?? 0)} tint="#E9C46A" sub="all skills" />
        <BigStat icon={Calendar} label="Daily" value={`${profile?.daily_minutes ?? 30}m`} tint="#4A5550" sub={profile?.tutor_personality ? profile.tutor_personality : ""} />
      </div>

      {/* Skill quick actions */}
      <section>
        <h2 className="font-serif-display text-xl sm:text-2xl mb-4">Continue training</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <SkillCard testid="skill-speaking" tint="#2D6A4F" icon={Mic} title="Speaking" desc="Talk with Ms. Aria." onClick={() => navigate("/app/speaking")} />
          <SkillCard testid="skill-writing" tint="#E07A5F" icon={PenLine} title="Writing" desc="Task 1 & 2 scoring." onClick={() => navigate("/app/writing")} />
          <SkillCard testid="skill-listening" tint="#E9C46A" icon={Headphones} title="Listening" desc="4-section narrated tests." onClick={() => navigate("/app/listening")} />
          <SkillCard testid="skill-reading" tint="#1A201C" icon={BookOpen} title="Reading" desc="Timed academic passages." onClick={() => navigate("/app/reading")} />
        </div>
      </section>

      {/* Pain points */}
      {pain && (pain.weakest?.length > 0 || pain.strongest?.length > 0) && (
        <section className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6" data-testid="pain-points-panel">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Pain points</div>
              <h3 className="font-serif-display text-xl sm:text-2xl mt-1">What to work on next</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#E07A5F] mb-3"><TrendingDown className="h-3.5 w-3.5" /> Weakest areas</div>
              {pain.weakest?.length > 0 ? (
                <ul className="space-y-3">
                  {pain.weakest.map((w) => (
                    <li key={w.label} className="flex items-start gap-3" data-testid={`weak-${w.label.toLowerCase().replace(/\s/g,'-')}`}>
                      <span className="font-serif-display text-2xl text-[#E07A5F] w-10 text-right">{w.band}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#1A201C]">{w.label}</div>
                        <div className="text-xs text-[#4A5550] leading-relaxed mt-0.5">{w.tip}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#8A958F]">Complete a few sessions to surface your weak spots.</p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#2D6A4F] mb-3"><TrendingUp className="h-3.5 w-3.5" /> Your strengths</div>
              {pain.strongest?.length > 0 ? (
                <ul className="space-y-2.5">
                  {pain.strongest.map((s) => (
                    <li key={s.label} className="flex items-center gap-3">
                      <span className="font-serif-display text-xl text-[#2D6A4F] w-10 text-right">{s.band}</span>
                      <span className="text-sm text-[#1A201C]">{s.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#8A958F]">—</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Visuals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Skill radar</div>
          <h3 className="font-serif-display text-xl sm:text-2xl mt-1">Where you stand</h3>
          <div className="h-64 sm:h-72 mt-2" style={{ minHeight: 240 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E5E2DC" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "#4A5550", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fill: "#8A958F", fontSize: 10 }} />
                <Radar name="band" dataKey="band" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-5 bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Progression</div>
          <h3 className="font-serif-display text-xl sm:text-2xl mt-1">Band history</h3>
          <div className="h-56 sm:h-64 mt-4" style={{ minHeight: 220 }}>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <LineChart data={history}>
                  <XAxis dataKey="date" tick={{ fill: "#8A958F", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[3, 9]} tick={{ fill: "#8A958F", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="band" stroke="#E07A5F" strokeWidth={2} dot={{ fill: "#E07A5F", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#8A958F] text-center px-6">
                Complete a session to see your progress.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const BigStat = ({ icon: Icon, label, value, sub, tint }) => (
  <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 sm:p-5">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: tint }} />
      <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#8A958F]">{label}</div>
    </div>
    <div className="font-serif-display text-2xl sm:text-3xl mt-2 sm:mt-3" style={{ color: tint }}>{value}</div>
    <div className="text-[10px] sm:text-xs text-[#8A958F] mt-1.5">{sub}</div>
  </div>
);

const SkillCard = ({ testid, icon: Icon, title, desc, onClick, tint }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className="text-left bg-white border border-[#E5E2DC] rounded-2xl p-4 sm:p-6 hover:-translate-y-1 hover:shadow-md transition-all group"
  >
    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center" style={{ background: tint + "22", color: tint }}>
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </div>
    <div className="font-serif-display text-lg sm:text-xl mt-3 sm:mt-4">{title}</div>
    <div className="text-xs sm:text-sm text-[#4A5550] mt-1">{desc}</div>
    <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs uppercase tracking-widest text-[#8A958F] group-hover:text-[#2D6A4F] transition-colors">Open →</div>
  </button>
);
