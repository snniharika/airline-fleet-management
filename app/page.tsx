
import Link from "next/link";

const modules = [
  { name: "Crew Scheduling", path: "/crew", icon: "👨‍✈️" },
  { name: "Crew Assignments", path: "/assignments", icon: "🗓️" },
  { name: "Maintenance Management", path: "/maintenance", icon: "🛠️" },
  { name: "Maintenance Reports", path: "/reports", icon: "📋" },
  { name: "Parts Management", path: "/parts", icon: "⚙️" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-3">
        Airline Fleet Management
      </h1>

      <p className="text-slate-400 mb-10">
        Fleet Maintenance, Flight-Hour & Crew Scheduling System
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Link
            key={module.path}
            href={module.path}
            className="bg-slate-800 p-8 rounded-xl hover:bg-slate-700 transition"
          >
            <div className="text-4xl mb-4">{module.icon}</div>

            <h2 className="text-xl font-semibold">
              {module.name}
            </h2>

            <p className="text-slate-400 mt-2">
              Open Module →
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
