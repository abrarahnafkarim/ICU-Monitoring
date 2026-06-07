import { useState, type FormEvent } from "react";
import { Activity, Lock, ShieldAlert, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (login(username, password)) {
      navigate("/", { replace: true });
    } else {
      setError(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="glass-card p-8 shadow-glow">
          {/* Logo + headings */}
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Activity size={28} strokeWidth={2.4} />
            </span>
            <h1 className="text-xl font-bold text-text">
              Remote Patient Monitoring System
            </h1>
            <p className="mt-1 text-sm text-muted">
              Continuous Health Monitoring Platform
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Username
              </span>
              <span className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(false);
                  }}
                  placeholder="admin"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-text outline-none transition-colors placeholder:text-muted/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Password
              </span>
              <span className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-text outline-none transition-colors placeholder:text-muted/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                <ShieldAlert size={16} />
                Invalid username or password.
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Demo credentials —{" "}
            <span className="font-mono text-text">admin</span> /{" "}
            <span className="font-mono text-text">admin123</span>
          </p>
        </div>
      </div>
    </main>
  );
}
