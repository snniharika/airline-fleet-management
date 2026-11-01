"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import OperationsShell, { Notice, Panel, inputClass, primaryButton, secondaryButton } from "@/components/OperationsShell";

type Flight = {
  flight_id: number;
  flight_number: string;
  aircraft_id: number;
  registration_no: string;
  model_name: string;
  departure_airport_id: number;
  departure_airport_code: string;
  departure_airport_name: string;
  arrival_airport_id: number;
  arrival_airport_code: string;
  arrival_airport_name: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  actual_departure: string | null;
  actual_arrival: string | null;
  flight_duration: number | string | null;
  flight_hours_recorded: number | string | null;
  flight_status: string;
};

type AircraftOption = {
  aircraft_id: number;
  registration_no: string;
  model_name: string;
  aircraft_status: string;
};

type Airport = {
  airport_id: number;
  airport_code: string;
  airport_name: string;
  city: string;
};

type FlightForm = {
  flight_number: string;
  aircraft_id: string;
  departure_airport_id: string;
  arrival_airport_id: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  flight_status: string;
};

const emptyForm: FlightForm = {
  flight_number: "",
  aircraft_id: "",
  departure_airport_id: "",
  arrival_airport_id: "",
  scheduled_departure: "",
  scheduled_arrival: "",
  flight_status: "SCHEDULED",
};

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function badge(status: string) {
  const styles: Record<string, string> = {
    SCHEDULED: "bg-slate-100 text-slate-700",
    BOARDING: "bg-blue-50 text-blue-700",
    DEPARTED: "bg-amber-50 text-amber-700",
    ARRIVED: "bg-emerald-50 text-emerald-700",
    DELAYED: "bg-orange-50 text-orange-700",
    CANCELLED: "bg-red-50 text-red-700",
  };
  return styles[status] ?? "bg-slate-100 text-slate-700";
}

export default function FlightsPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [aircraft, setAircraft] = useState<AircraftOption[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const [form, setForm] = useState<FlightForm>(emptyForm);
  const [completeFlight, setCompleteFlight] = useState<Flight | null>(null);
  const [actualDeparture, setActualDeparture] = useState("");
  const [actualArrival, setActualArrival] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [flightResponse, aircraftResponse, airportResponse] = await Promise.all([
        fetch("/api/flights", { cache: "no-store" }),
        fetch("/api/aircraft", { cache: "no-store" }),
        fetch("/api/airports", { cache: "no-store" }),
      ]);
      const [flightData, aircraftData, airportData] = await Promise.all([
        flightResponse.json(), aircraftResponse.json(), airportResponse.json(),
      ]);
      if (!flightResponse.ok) throw new Error(flightData.error || "Could not load flights.");
      if (!aircraftResponse.ok) throw new Error(aircraftData.error || "Could not load aircraft.");
      if (!airportResponse.ok) throw new Error(airportData.error || "Could not load airports.");
      setFlights(flightData.flights ?? []);
      setAircraft(Array.isArray(aircraftData) ? aircraftData : aircraftData.aircraft ?? []);
      setAirports(Array.isArray(airportData) ? airportData : airportData.airports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load flight data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredFlights = useMemo(() => flights.filter((flight) => {
    const matchesSearch = flight.flight_number.toLowerCase().includes(search.trim().toLowerCase());
    const matchesDate = !dateFilter || flight.scheduled_departure.slice(0, 10) === dateFilter;
    const matchesStatus = statusFilter === "ALL" || flight.flight_status === statusFilter;
    return matchesSearch && matchesDate && matchesStatus;
  }), [flights, search, dateFilter, statusFilter]);

  const upcomingCount = flights.filter((f) => ["SCHEDULED", "BOARDING"].includes(f.flight_status)).length;
  const arrivedCount = flights.filter((f) => f.flight_status === "ARRIVED").length;
  const activeAircraft = aircraft.filter((a) => a.aircraft_status === "ACTIVE").length;

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, aircraft_id: aircraft.find((a) => a.aircraft_status === "ACTIVE") ? String(aircraft.find((a) => a.aircraft_status === "ACTIVE")!.aircraft_id) : "", departure_airport_id: airports[0] ? String(airports[0].airport_id) : "", arrival_airport_id: airports[1] ? String(airports[1].airport_id) : "" });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEdit(flight: Flight) {
    setEditing(flight);
    setForm({
      flight_number: flight.flight_number,
      aircraft_id: String(flight.aircraft_id),
      departure_airport_id: String(flight.departure_airport_id),
      arrival_airport_id: String(flight.arrival_airport_id),
      scheduled_departure: toLocalInput(flight.scheduled_departure),
      scheduled_arrival: toLocalInput(flight.scheduled_arrival),
      flight_status: flight.flight_status,
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  async function submitFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    if (form.departure_airport_id === form.arrival_airport_id) {
      setError("Departure and arrival airports must be different.");
      setSaving(false);
      return;
    }
    if (new Date(form.scheduled_arrival).getTime() <= new Date(form.scheduled_departure).getTime()) {
      setError("Scheduled arrival must be after scheduled departure.");
      setSaving(false);
      return;
    }
    const payload = {
      ...form,
      flight_number: form.flight_number.trim().toUpperCase(),
      aircraft_id: Number(form.aircraft_id),
      departure_airport_id: Number(form.departure_airport_id),
      arrival_airport_id: Number(form.arrival_airport_id),
    };
    try {
      const response = await fetch(editing ? `/api/flights/${editing.flight_id}` : "/api/flights", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flight could not be saved.");
      setFormOpen(false);
      setSuccess(editing ? "Flight updated successfully." : "Flight scheduled successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flight could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completeFlight) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/flights/${completeFlight.flight_id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_departure: actualDeparture, actual_arrival: actualArrival }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flight completion failed.");
      setCompleteFlight(null);
      setSuccess(`Flight ${completeFlight.flight_number} completed. ${Number(data.flight_hours_added).toFixed(2)} flight hours recorded.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flight completion failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OperationsShell active="/flights" eyebrow="FLIGHT OPERATIONS" title="Flight Scheduling" description="Schedule flights, assign eligible aircraft and prevent conflicting schedules.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Flights", flights.length, "All flight records"],
          ["Upcoming Flights", upcomingCount, "Scheduled or boarding"],
          ["Completed Flights", arrivedCount, "Successfully arrived"],
          ["Active Aircraft", activeAircraft, "Eligible for scheduling"],
        ].map(([label, value, hint]) => <Panel key={String(label)} className="!p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></Panel>)}
      </div>

      {error && !formOpen && !completeFlight && <div className="mb-5"><Notice>{error}</Notice></div>}
      {success && <div className="mb-5"><Notice kind="success">{success}</Notice></div>}

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="text-lg font-bold">Flight Schedule</h3><p className="mt-1 text-sm text-slate-500">Search by flight number, filter by date or status, and manage flight records.</p></div>
          <button className={primaryButton} onClick={openCreate}>+ Schedule Flight</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_210px_190px_auto]">
          <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flight number..." />
          <input type="date" className={inputClass} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            {["SCHEDULED", "BOARDING", "DEPARTED", "ARRIVED", "DELAYED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className={secondaryButton} onClick={() => { setSearch(""); setDateFilter(""); setStatusFilter("ALL"); void loadData(); }}>Reset / Refresh</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Flight</th><th className="px-3 py-3">Aircraft</th><th className="px-3 py-3">Route</th><th className="px-3 py-3">Departure</th><th className="px-3 py-3">Arrival</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">Loading flight schedule...</td></tr> : filteredFlights.map((flight) => (
                <tr key={flight.flight_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-3 py-4 font-semibold">{flight.flight_number}<p className="mt-1 text-xs font-normal text-slate-500">ID #{flight.flight_id}</p></td>
                  <td className="px-3 py-4">{flight.registration_no}<p className="mt-1 text-xs text-slate-500">{flight.model_name}</p></td>
                  <td className="px-3 py-4 font-medium">{flight.departure_airport_code} → {flight.arrival_airport_code}</td>
                  <td className="px-3 py-4 text-slate-600">{displayDate(flight.scheduled_departure)}</td>
                  <td className="px-3 py-4 text-slate-600">{displayDate(flight.scheduled_arrival)}</td>
                  <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge(flight.flight_status)}`}>{flight.flight_status}</span></td>
                  <td className="px-3 py-4"><div className="flex justify-end gap-3 whitespace-nowrap"><button className="font-semibold text-sky-700 hover:text-sky-900" disabled={["ARRIVED", "CANCELLED"].includes(flight.flight_status)} onClick={() => openEdit(flight)}>Edit</button>{!["ARRIVED", "CANCELLED"].includes(flight.flight_status) && <button className="font-semibold text-emerald-700 hover:text-emerald-900" onClick={() => { setCompleteFlight(flight); setActualDeparture(flight.actual_departure ? toLocalInput(flight.actual_departure) : toLocalInput(flight.scheduled_departure)); setActualArrival(flight.actual_arrival ? toLocalInput(flight.actual_arrival) : toLocalInput(flight.scheduled_arrival)); setError(""); }}>Complete</button>}</div></td>
                </tr>
              ))}
              {!loading && filteredFlights.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No flights match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {formOpen && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 py-8"><div className="my-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Flight operations</p><h3 className="mt-1 text-xl font-bold">{editing ? "Edit Flight" : "Schedule Flight"}</h3><p className="mt-1 text-sm text-slate-500">The server validates aircraft eligibility and schedule conflicts.</p></div><button className="text-2xl text-slate-400" onClick={() => setFormOpen(false)}>×</button></div>
        {error && <div className="mb-4"><Notice>{error}</Notice></div>}
        <form onSubmit={submitFlight} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Flight number<input required maxLength={20} className={`${inputClass} mt-1.5`} value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value.toUpperCase() })} placeholder="AI505" /></label>
          <label className="text-sm font-medium text-slate-700">Aircraft<select required className={`${inputClass} mt-1.5`} value={form.aircraft_id} onChange={(e) => setForm({ ...form, aircraft_id: e.target.value })}><option value="">Select active aircraft</option>{aircraft.filter((a) => a.aircraft_status === "ACTIVE" || (editing && a.aircraft_id === editing.aircraft_id)).map((a) => <option key={a.aircraft_id} value={a.aircraft_id}>{a.registration_no} · {a.model_name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Departure airport<select required className={`${inputClass} mt-1.5`} value={form.departure_airport_id} onChange={(e) => setForm({ ...form, departure_airport_id: e.target.value })}><option value="">Select departure</option>{airports.map((a) => <option key={a.airport_id} value={a.airport_id}>{a.airport_code} · {a.city}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Arrival airport<select required className={`${inputClass} mt-1.5`} value={form.arrival_airport_id} onChange={(e) => setForm({ ...form, arrival_airport_id: e.target.value })}><option value="">Select arrival</option>{airports.map((a) => <option key={a.airport_id} value={a.airport_id}>{a.airport_code} · {a.city}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Scheduled departure<input required type="datetime-local" className={`${inputClass} mt-1.5`} value={form.scheduled_departure} onChange={(e) => setForm({ ...form, scheduled_departure: e.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">Scheduled arrival<input required type="datetime-local" className={`${inputClass} mt-1.5`} value={form.scheduled_arrival} onChange={(e) => setForm({ ...form, scheduled_arrival: e.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Flight status<select className={`${inputClass} mt-1.5`} value={form.flight_status} onChange={(e) => setForm({ ...form, flight_status: e.target.value })}>{["SCHEDULED", "BOARDING", "DEPARTED", "DELAYED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="col-span-full mt-2 flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className={secondaryButton} onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className={primaryButton} disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Schedule Flight"}</button></div>
        </form>
      </div></div>}

      {completeFlight && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Flight completion</p><h3 className="mt-1 text-xl font-bold">Complete {completeFlight.flight_number}</h3><p className="mt-1 text-sm text-slate-500">Actual flight hours will be added to the aircraft in one database transaction.</p></div><button className="text-2xl text-slate-400" onClick={() => setCompleteFlight(null)}>×</button></div>
        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
        <form onSubmit={submitCompletion} className="mt-5 grid gap-4">
          <label className="text-sm font-medium text-slate-700">Actual departure<input required type="datetime-local" className={`${inputClass} mt-1.5`} value={actualDeparture} onChange={(e) => setActualDeparture(e.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Actual arrival<input required type="datetime-local" className={`${inputClass} mt-1.5`} value={actualArrival} onChange={(e) => setActualArrival(e.target.value)} /></label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className={secondaryButton} onClick={() => setCompleteFlight(null)}>Cancel</button><button type="submit" className={primaryButton} disabled={saving}>{saving ? "Completing..." : "Confirm Completion"}</button></div>
        </form>
      </div></div>}
    </OperationsShell>
  );
}
