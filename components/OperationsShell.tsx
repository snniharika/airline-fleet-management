import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/aircraft", label: "Aircraft Management" },
  { href: "/flights", label: "Flight Scheduling" },
  { href: "/crew", label: "Crew Scheduling" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/reports", label: "Maintenance Reports" },
  { href: "/parts", label: "Parts Usage" },
];

export default function OperationsShell({
  active,
  eyebrow,
  title,
  description,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-slate-950 p-6 text-white md:flex">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
            Fleet Operations
          </p>
          <h1 className="mt-3 text-2xl font-bold">AeroManage</h1>
          <p className="mt-2 text-sm text-slate-400">Airline fleet management</p>
        </div>
        <nav className="flex flex-col gap-2">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                active === item.href
                  ? "bg-sky-500/15 text-sky-300"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-5">
          <p className="text-sm text-slate-400">DBMS Mini Project</p>
          <p className="mt-1 text-xs text-slate-500">Aircraft and flight operations</p>
        </div>
      </aside>

      <div className="md:ml-64">
        <div className="border-b border-slate-200 bg-white px-5 py-3 md:hidden">
          <p className="font-bold text-slate-900">AeroManage</p>
          <nav className="mt-2 flex gap-3 overflow-x-auto pb-1 text-xs">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className={active === item.href ? "whitespace-nowrap font-bold text-sky-700" : "whitespace-nowrap text-slate-500"}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <main className="min-h-screen p-5 sm:p-8 lg:p-10">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-sky-700">{eyebrow}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
              <p className="mt-2 text-slate-500">{description}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">System</p>
              <p className="mt-1 font-semibold text-emerald-700">● Operations workspace</p>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function Notice({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
