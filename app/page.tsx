
"use client";

import AuthControls from "@/components/AuthControls";
import { useEffect, useState } from "react";
import Link from "next/link";

type Aircraft = {
  aircraft_id: number;
  registration_id: string;
  aircraft_status: string;
  total_flight_hours: number | string;
  next_maintenance_due_hours?: number | string | null;
  remaining_hours_until_maintenance?: number | string | null;
  maintenance_status?: string;
};

type Flight = {
  flight_id: number;
  flight_number: string;
  registration_id?: string;
  aircraft_id: number;
  departure_airport?: string;
  arrival_airport?: string;
  departure_airport_code?: string;
  arrival_airport_code?: string;
  departure_airport_name?: string;
  arrival_airport_name?: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  flight_status: string;
};

function extractRows<T>(
  response: unknown,
  possibleKeys: string[]
): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (response && typeof response === "object") {
    const object = response as Record<string, unknown>;

    for (const key of possibleKeys) {
      if (Array.isArray(object[key])) {
        return object[key] as T[];
      }
    }
  }

  return [];
}

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHours(value: number | string | null | undefined) {
  const hours = Number(value);

  return Number.isFinite(hours) ? hours.toFixed(2) : "0.00";
}

export default function Dashboard() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setError("");

        const [aircraftResponse, flightsResponse] = await Promise.all([
          fetch("/api/aircraft", { cache: "no-store" }),
          fetch("/api/flights", { cache: "no-store" }),
        ]);

        if (!aircraftResponse.ok || !flightsResponse.ok) {
          throw new Error(
            "Could not load dashboard data. Check the aircraft and flight APIs."
          );
        }

        const aircraftData: unknown = await aircraftResponse.json();
        const flightsData: unknown = await flightsResponse.json();

        if (cancelled) return;

        setAircraft(
          extractRows<Aircraft>(aircraftData, [
            "aircraft",
            "data",
            "results",
          ])
        );

        setFlights(
          extractRows<Flight>(flightsData, [
            "flights",
            "data",
            "results",
          ])
        );
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeAircraft = aircraft.filter(
    (item) => item.aircraft_status?.toUpperCase() === "ACTIVE"
  ).length;

  const maintenanceAircraft = aircraft.filter((item) => {
    const status = item.maintenance_status?.toUpperCase();

    if (status) {
      return [
        "DUE_SOON",
        "DUE",
        "OVERDUE",
        "DUE_FOR_MAINTENANCE",
      ].includes(status);
    }

    if (item.next_maintenance_due_hours == null) {
      return false;
    }

    const remaining =
      Number(item.next_maintenance_due_hours) -
      Number(item.total_flight_hours);

    return remaining <= 50;
  }).length;

  const upcomingFlights = flights
    .filter((flight) => {
      const status = flight.flight_status?.toUpperCase();

      return ["SCHEDULED", "BOARDING"].includes(status);
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_departure).getTime() -
        new Date(b.scheduled_departure).getTime()
    );

  const totalFlightHours = aircraft.reduce(
    (sum, item) => sum + Number(item.total_flight_hours || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 p-6 text-white md:flex">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
            Fleet Operations
          </p>

          <h1 className="mt-3 text-2xl font-bold">
            AeroManage
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Airline fleet management
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            href="/"
            className="rounded-lg bg-sky-500/15 px-4 py-3 font-medium text-sky-300"
          >
            Dashboard
          </Link>

          <Link
            href="/aircraft"
            className="rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800"
          >
            Aircraft Management
          </Link>

          <Link
            href="/flights"
            className="rounded-lg px-4 py-3 text-slate-300 transition hover:bg-slate-800"
          >
            Flight Scheduling
          </Link>
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-5">
          <p className="text-sm text-slate-400">
            DBMS Mini Project
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Aircraft and flight operations
          </p>
        </div>
      </aside>

      <main className="min-h-screen p-5 sm:p-8 md:ml-64 md:p-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-700">
              OPERATIONS OVERVIEW
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Dashboard
            </h2>

            <p className="mt-2 text-slate-500">
              Monitor aircraft availability, maintenance and flight schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">
                System status
              </p>

              <p className="mt-1 font-semibold text-emerald-700">
                Connected to dashboard APIs
              </p>
            </div>

            <AuthControls />
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">
              Dashboard data could not be loaded
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading aircraft and flight data...
          </div>
        ) : (
          <>
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total Aircraft"
                value={aircraft.length}
                description="Aircraft in the database"
                accent="blue"
              />

              <MetricCard
                title="Active Aircraft"
                value={activeAircraft}
                description="Currently marked ACTIVE"
                accent="green"
              />

              <MetricCard
                title="Maintenance Alerts"
                value={maintenanceAircraft}
                description="At or within 50 hours of the threshold"
                accent="amber"
              />

              <MetricCard
                title="Upcoming Flights"
                value={upcomingFlights.length}
                description="Scheduled or boarding flights"
                accent="purple"
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">
                      Upcoming Flights
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Flights ordered by scheduled departure
                    </p>
                  </div>

                  <Link
                    href="/flights"
                    className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Manage flights →
                  </Link>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3">
                          Flight
                        </th>

                        <th className="px-3 py-3">
                          Route
                        </th>

                        <th className="px-3 py-3">
                          Departure
                        </th>

                        <th className="px-3 py-3">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {upcomingFlights.slice(0, 6).map((flight) => (
                        <tr
                          key={flight.flight_id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-4 font-semibold">
                            {flight.flight_number}
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {flight.departure_airport_code ??
                              flight.departure_airport ??
                              "—"}{" "}
                            →{" "}
                            {flight.arrival_airport_code ??
                              flight.arrival_airport ??
                              "—"}
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {formatDate(flight.scheduled_departure)}
                          </td>

                          <td className="px-3 py-4">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              {flight.flight_status}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {upcomingFlights.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No upcoming flights found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">
                  Fleet Flight Hours
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cumulative aircraft hours
                </p>

                <p className="mt-7 text-4xl font-bold tracking-tight">
                  {formatHours(totalFlightHours)}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Total hours recorded across aircraft
                </p>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      Aircraft records
                    </span>

                    <span className="font-semibold">
                      {aircraft.length}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      Non-active aircraft
                    </span>

                    <span className="font-semibold">
                      {aircraft.length - activeAircraft}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-4 text-lg font-bold">
                Quick Actions
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/aircraft"
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-sky-700">
                    AIRCRAFT OPERATIONS
                  </p>

                  <h4 className="mt-3 text-xl font-bold">
                    Manage Aircraft
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    View registrations, update aircraft details and monitor
                    maintenance thresholds.
                  </p>

                  <p className="mt-5 font-semibold text-sky-700">
                    Open aircraft management →
                  </p>
                </Link>

                <Link
                  href="/flights"
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-sky-700">
                    FLIGHT OPERATIONS
                  </p>

                  <h4 className="mt-3 text-xl font-bold">
                    Manage Flights
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    Schedule flights, review existing routes and complete
                    flights.
                  </p>

                  <p className="mt-5 font-semibold text-sky-700">
                    Open flight scheduling →
                  </p>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  accent,
}: {
  title: string;
  value: number;
  description: string;
  accent: "blue" | "green" | "amber" | "purple";
}) {
  const accentClasses = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-4xl font-bold tracking-tight">
            {value}
          </p>
        </div>

        <div
          className={`rounded-xl px-3 py-2 text-xs font-bold ${accentClasses[accent]}`}
        >
          LIVE
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
