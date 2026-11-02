
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  user_id: number;
  username: string;
  email: string;
  role: "ADMIN" | "STAFF";
};

export default function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) router.replace("/login");
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {user.username}
        </p>
        <p className="text-xs font-medium text-sky-700">
          {user.role}
        </p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {loggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
