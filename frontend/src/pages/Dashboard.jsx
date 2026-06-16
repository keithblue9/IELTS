import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Mic, PenLine, Headphones, BookOpen, Flame, Target, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/profile").then((r) => setProfile(r.data));
    api.get("/dashboard/stats").then((r) => setStats(r.data));
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
    <div className="space-y-10" data-testid="dashboard-page">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Welcome back</div>
        <h1 className="font-serif-display text-4xl sm:text-5xl mt-2">Hello, {user?.name?.split(" ")[0] || "there"}.</h1>
        <p className="text-[#4A5550] mt-3 max-w-xl">Pick a skill and start training. Aria is ready when you are.</p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BigStat
          icon={Target}
          label="Target band"
          value={target.toFixed(1)}
          tint="#2D6A4F"
          sub={profile?.test_date ? `Test ${profile.test_date}` : "No test date set"}
        />
        <BigStat
          icon={Sparkles}
          label="Estimated band"
          value={overall ? Number(overall).toFixed(1) : "—"}
          tint="#E07A5F"
          sub={overall ? `${progressPct}% of band 9` : "Take a session to begin"}
        />
        <BigStat
          icon={Flame}
          label="Sessions completed"
          value={(stats?.counts?.speaking_sessions ?? 0) + (stats?.counts?.writing_submissions ?? 0) + (stats?.counts?.listening_attempts ?? 0)}
          tint="#E9C46A"
          sub="across all skills"
        />
        <BigStat
          icon={Calendar}
          label="Daily target"
          value={`${profile?.daily_minutes ?? 30}m`}
          tint="#4A5550"
          sub={profile?.tutor_personality ? `${profile.tutor_personality} examiner` : ""}
        />
      </div>

      {/* Skill quick actions */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-serif-display text-2xl">Continue training</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkillCard testid="skill-speaking" tint="#2D6A4F" icon={Mic} title="Speaking" desc="Talk with Ms. Aria, the AI examiner." onClick={() => navigate("/app/speaking")} />
          <SkillCard testid="skill-writing" tint="#E07A5F" icon={PenLine} title="Writing" desc="Task 1 & 2 scoring, with model answers." onClick={() => navigate("/app/writing")} />
          <SkillCard testid="skill-listening" tint="#E9C46A" icon={Headphones} title="Listening" desc="4-section narrated tests, 40 questions." onClick={() => navigate("/app/listening")} />
          <SkillCard testid="skill-reading" tint="#1A201C" icon={BookOpen} title="Reading" desc="Academic passages with timed grading." onClick={() => navigate("/app/reading")} />
        </div>
      </section>

      {/* Visuals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5E2DC] rounded-2xl p-6">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Skill radar</div>
              <h3 className="font-serif-display text-2xl mt-1">Where you stand</h3>
            </div>
            <div className="text-xs text-[#8A958F]">Updated live from your sessions</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E5E2DC" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "#4A5550", fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fill: "#8A958F", fontSize: 10 }} />
                <Radar name="band" dataKey="band" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-5 bg-white border border-[#E5E2DC] rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">Progression</div>
          <h3 className="font-serif-display text-2xl mt-1">Band history</h3>
          <div className="h-64 mt-4">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
  <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: tint }} />
      <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F]">{label}</div>
    </div>
    <div className="font-serif-display text-3xl mt-3" style={{ color: tint }}>{value}</div>
    <div className="text-xs text-[#8A958F] mt-2">{sub}</div>
  </div>
);

const SkillCard = ({ testid, icon: Icon, title, desc, onClick, tint }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className="text-left bg-white border border-[#E5E2DC] rounded-2xl p-6 hover:-translate-y-1 hover:shadow-md transition-all group"
  >
    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: tint + "22", color: tint }}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="font-serif-display text-xl mt-4">{title}</div>
    <div className="text-sm text-[#4A5550] mt-1">{desc}</div>
    <div className="mt-4 text-xs uppercase tracking-widest text-[#8A958F] group-hover:text-[#2D6A4F] transition-colors">Open →</div>
  </button>
);
