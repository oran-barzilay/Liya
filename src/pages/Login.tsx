import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        // Auto sign-in after sign-up (Supabase does this when email confirmation is disabled)
        // If email confirmation IS enabled, show a message instead
        try {
          await signIn(email, password);
          navigate("/");
        } catch {
          setInfo("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-3xl font-bold text-indigo-400">Family ERP</h1>
          <p className="text-slate-400 mt-2 text-sm">Manage your household, together</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 mb-4">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
            className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (mode === "signin" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
            className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (mode === "signup" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
          >
            Create account
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          {mode === "signup" && (
            <div className="bg-indigo-950/50 border border-indigo-800 rounded-lg px-3 py-2.5 text-xs text-indigo-300">
              👋 First time? Create an account here. After signing up you'll set up your household name and profile.
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="oran@family.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}
          {info && (
            <p className="text-emerald-400 text-sm bg-emerald-950/50 border border-emerald-800 rounded-lg px-3 py-2">
              ✓ {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading
              ? mode === "signup" ? "Creating account…" : "Signing in…"
              : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {mode === "signin" && (
          <p className="text-center text-xs text-slate-500 mt-4">
            Don't have an account?{" "}
            <button onClick={() => setMode("signup")} className="text-indigo-400 hover:text-indigo-300 underline">
              Create one
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

