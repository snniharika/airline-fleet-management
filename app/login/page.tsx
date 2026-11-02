
"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (response.ok && active) {
          router.replace("/");
          return;
        }
      } catch {
        // A missing session is expected on the login page.
      }

      if (active) {
        setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed. Please try again.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Checking your session...
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-12 text-white md:flex">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
              Fleet Operations
            </p>

            <h1 className="mt-5 text-4xl font-bold leading-tight">
              AeroManage
            </h1>

            <p className="mt-5 max-w-sm leading-7 text-slate-300">
              Airline Fleet Maintenance, Flight-Hour and Crew Scheduling
              System.
            </p>
          </div>

          <div>
            <div className="mb-6 h-px bg-white/15" />
            <p className="text-sm text-slate-400">
              Centralized operations management
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Secure access for authorized personnel
            </p>
          </div>
        </section>

        <section className="px-7 py-12 sm:px-12">
          <div className="mb-9 md:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-700">
              Fleet Operations
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              AeroManage
            </h1>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">
              Welcome back
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Sign in to your account
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Enter your registered credentials to access the fleet
              operations dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-9 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-900/10 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Access is restricted to authorized Admin and Staff accounts.
            Contact your system administrator if you need an account.
          </p>
        </section>
      </div>
    </main>
  );
}
