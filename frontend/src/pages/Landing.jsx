import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mic, PenLine, Headphones, BookOpen, Target, Sparkles, CheckCircle2 } from "lucide-react";
import AIVoiceOrb from "@/components/AIVoiceOrb";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1A201C] grain-bg">
      {/* nav */}
      <header className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center">
            <span className="font-serif-display text-[#F9F8F6] text-lg leading-none">A</span>
          </div>
          <div>
            <div className="font-serif-display text-xl font-medium">Ascent IELTS</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8A958F]">AI Mentor</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" data-testid="landing-login-link">
            <Button variant="ghost" className="text-[#1A201C] hover:bg-[#EFEBE3]">Sign in</Button>
          </Link>
          <Link to="/signup" data-testid="landing-signup-link">
            <Button className="bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-5 hover:-translate-y-0.5 transition-transform">
              Start free trial
            </Button>
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#2D6A4F] bg-[#E8EFE9] border border-[#CFE0D3] rounded-full px-3 py-1.5 mb-8">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Claude Sonnet 4.5
          </div>
          <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight">
            Speak with an<br />
            <em className="text-[#E07A5F] not-italic" style={{ fontFamily: "Newsreader", fontStyle: "italic", fontWeight: 500 }}>AI examiner.</em><br />
            Reach <span className="underline decoration-[#E9C46A] decoration-[6px] underline-offset-[10px]">band 8</span> faster.
          </h1>
          <p className="mt-8 text-lg text-[#4A5550] max-w-xl leading-relaxed">
            Ascent is your private IELTS mentor — voice conversations, instant essay scoring,
            and full mock tests, calibrated to the official IELTS band descriptors.
            Train the way you'll be examined.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link to="/signup" data-testid="hero-cta-signup">
              <Button className="bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] h-12 px-7 rounded-full text-base hover:-translate-y-0.5 transition-transform">
                Start your first session <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" data-testid="hero-cta-login">
              <Button variant="outline" className="h-12 px-7 rounded-full border-[#1A201C]/15 text-base hover:bg-[#EFEBE3]">
                I already have an account
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
            <Stat n="9.0" label="Max band" />
            <Stat n="4" label="Skills covered" />
            <Stat n="∞" label="Practice tests" />
            <Stat n="24/7" label="AI examiner" />
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div className="aspect-[5/6] rounded-3xl overflow-hidden bg-[#EFEBE3] relative">
            <img
              src="https://images.unsplash.com/photo-1563737590014-5d5c37378130?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwyfHxzdHVkZW50JTIwc3R1ZHlpbmclMjBsaWJyYXJ5JTIwbGFwdG9wfGVufDB8fHx8MTc4MTU3ODg0OXww&ixlib=rb-4.1.0&q=85"
              alt="Student studying"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A201C]/40 via-transparent to-transparent" />
          </div>
          {/* floating orb card */}
          <div className="absolute -left-6 lg:-left-12 bottom-8 bg-white rounded-2xl shadow-2xl border border-[#E5E2DC] p-5 w-72">
            <div className="flex items-center gap-4">
              <div style={{ transform: "scale(0.4)", transformOrigin: "center", width: 56, height: 56 }} className="relative">
                <div style={{ position: "absolute", left: -42, top: -42 }}>
                  <AIVoiceOrb state="speaking" size={140} />
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-[#8A958F]">Ms. Aria · examiner</div>
                <div className="font-serif-display text-base mt-1 leading-snug">"Let's talk about your hometown. Where did you grow up?"</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* feature pillars */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 border-t border-[#E5E2DC]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F] mb-3">What you'll train</div>
            <h2 className="font-serif-display text-4xl leading-tight">Four skills.<br />One AI mentor.</h2>
            <p className="mt-5 text-[#4A5550] leading-relaxed">
              Every session is graded against the official IELTS public band descriptors.
              No vague "good job" — you get actionable feedback at the criterion level.
            </p>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard icon={Mic} title="Speaking" body="Full Part 1, 2 & 3 simulation with a voice examiner. Real microphone, real cue card, real timing." />
            <FeatureCard icon={PenLine} title="Writing" body="Upload .docx/.pdf or paste your essay. Get band score, annotated feedback, and a model band-8 answer." />
            <FeatureCard icon={Headphones} title="Listening" body="On-demand listening tests with AI-narrated audio across 4 sections and 40 questions." />
            <FeatureCard icon={BookOpen} title="Reading" body="Academic passages with T/F/NG, MCQ and short answer. Timed and instantly graded." />
          </div>
        </div>
      </section>

      {/* setup is yours */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="rounded-3xl bg-[#1A201C] text-[#F9F8F6] p-10 lg:p-14 relative overflow-hidden">
          <Target className="h-8 w-8 text-[#E9C46A] mb-6" />
          <h3 className="font-serif-display text-3xl leading-snug">Set your target band.<br />We build the runway.</h3>
          <p className="mt-5 text-[#D4CFC4] leading-relaxed">
            Tell us your target — say 7.5 — your test date, and your weak areas. Every prompt,
            cue card, and feedback note is calibrated to close the gap from where you are to where
            you need to be.
          </p>
          <ul className="mt-8 space-y-2 text-sm">
            <Li>Personalised tutor personality & voice</Li>
            <Li>Daily target study minutes</Li>
            <Li>Native-language awareness for common mistakes</Li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8A958F] mb-3">Configurable from day one</div>
          <h3 className="font-serif-display text-4xl leading-tight">Tune everything to your test plan.</h3>
          <p className="mt-5 text-[#4A5550] leading-relaxed max-w-md">
            Pick examiner voices (nova, onyx, shimmer…), choose strict vs encouraging feedback,
            and watch your radar chart fill in across Fluency, Lexical, Grammar, and Pronunciation.
          </p>
          <Link to="/signup" data-testid="setup-cta-signup" className="inline-block mt-8">
            <Button className="bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] rounded-full px-6 h-11">
              Configure my plan <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-[#E5E2DC] py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#8A958F]">
          <div>© {new Date().getFullYear()} Ascent IELTS. Independent practice platform — not affiliated with IELTS.</div>
          <div className="flex gap-6">
            <span>Built for learners, examined like the real thing.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const Stat = ({ n, label }) => (
  <div>
    <div className="font-serif-display text-3xl text-[#1A201C]">{n}</div>
    <div className="text-xs uppercase tracking-widest text-[#8A958F] mt-1">{label}</div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, body }) => (
  <div className="border border-[#E5E2DC] rounded-2xl p-6 bg-white hover:-translate-y-0.5 transition-transform">
    <Icon className="h-5 w-5 text-[#2D6A4F]" />
    <h4 className="font-serif-display text-xl mt-4">{title}</h4>
    <p className="mt-2 text-sm text-[#4A5550] leading-relaxed">{body}</p>
  </div>
);

const Li = ({ children }) => (
  <li className="flex items-start gap-3">
    <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#E9C46A] shrink-0" />
    <span>{children}</span>
  </li>
);
