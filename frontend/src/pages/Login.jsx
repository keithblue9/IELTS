import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/app");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center px-6 grain-bg">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-10" data-testid="login-logo-link">
          <div className="h-10 w-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center text-[#F9F8F6]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-serif-display text-xl">Ascent IELTS</span>
        </Link>
        <h1 className="font-serif-display text-4xl mb-3">Welcome back</h1>
        <p className="text-[#4A5550] mb-8">Continue training toward your band.</p>
        <form onSubmit={submit} className="space-y-5 bg-white border border-[#E5E2DC] rounded-2xl p-8">
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input id="email" data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input id="password" data-testid="login-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
          </div>
          <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full bg-[#2D6A4F] hover:bg-[#1B4332] text-[#F9F8F6] h-11 rounded-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-[#4A5550] text-center">
          No account yet?{" "}
          <Link to="/signup" className="text-[#2D6A4F] underline underline-offset-4" data-testid="login-to-signup-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}
