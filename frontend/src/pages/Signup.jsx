import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success("Welcome! Let's set up your IELTS plan.");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center px-6 grain-bg">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-10" data-testid="signup-logo-link">
          <div className="h-10 w-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-[#F9F8F6]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-serif-display text-xl">Ascent IELTS</span>
        </Link>
        <h1 className="font-serif-display text-4xl mb-3">Start your journey</h1>
        <p className="text-[#4A5550] mb-8">Create your free practice account.</p>
        <form onSubmit={submit} className="space-y-5 bg-white border border-[#E5E2DC] rounded-2xl p-8">
          <div>
            <Label htmlFor="name" className="text-sm">Full name</Label>
            <Input id="name" data-testid="signup-name-input" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input id="email" data-testid="signup-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input id="password" data-testid="signup-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
            <p className="text-xs text-[#8A958F] mt-1.5">Minimum 6 characters.</p>
          </div>
          <Button data-testid="signup-submit-btn" type="submit" disabled={loading} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] h-11 rounded-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-[#4A5550] text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-[#2D6A4F] underline underline-offset-4" data-testid="signup-to-login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
