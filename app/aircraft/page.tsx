"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import OperationsShell, { Notice, Panel, inputClass, primaryButton, secondaryButton } from "@/components/OperationsShell";

type Aircraft = {
  aircraft_id: number;
  registration_no: string;
  model_id: number;
  model_name: string;
  manufacturer: string;
  current_airport_id: number;
  current_airport_code: string;
  current_airport_name: string;
  manufacture_date: string | null;
  purchase_date: string | null;
  total_flight_hours: number | string;
  total_flight_cycles: number | string;
  aircraft_status: string;
  last_maintenance_date: string | null;
  next_maintenance_due_hours: number | string | null;
  maintenance_interval_hours: number | string;
  maintenance_status?: string;
  remaining_hours_until_maintenance?: number | null;
};

type Model = {
  model_id: number;
  model_name: string;
  manufacturer: string;
  seat_capacity: number;
  maintenance_interval_hours: number | string;
  maintenance_status?: string;
  remaining_hours_until_maintenance?: number | null;
};

type Airport = {
  airport_id: number;
  airport_code: string;
  airport_name: string;
  city: string;
};

type FormState = {
  registration_no: string;
  model_id: string;
  current_airport_id: string;
  manufacture_date: string;
  purchase_date: string;
  total_flight_hours: string;
  total_flight_cycles: string;
  aircraft_status: string;
  last_maintenance_date: string;
  next_maintenance_due_hours: string;
};

const emptyForm: FormState = {
  registration_no: "",
  model_id: "",
  current_airport_id: "",
  manufacture_date: "",
  purchase_date: "",
  total_flight_hours: "0",
  total_flight_cycles: "0",
  aircraft_status: "ACTIVE",
  last_maintenance_date: "",
  next_maintenance_due_hours: "",
};

function dateOnly(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function remainingHours(item: Aircraft) {
  if (item.next_maintenance_due_hours === null) return null;
  return Number(item.next_maintenance_due_hours) - Number(item.total_flight_hours);
}

function maintenanceLabel(item: Aircraft) {
  const remaining = remainingHours(item);
  if (remaining === null) return "NOT SET";
  if (remaining <= 0) return "OVERDUE";
  if (remaining <= 50) return "DUE SOON";
  return "OK";
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE": return "bg-emerald-50 text-emerald-700";
    case "MAINTENANCE": return "bg-amber-50 text-amber-700";
    case "GROUNDED": return "bg-red-50 text-red-700";
    case "RETIRED": return "bg-slate-100 text-slate-600";
    case "OVERDUE": return "bg-red-50 text-red-700";
    case "DUE SOON": return "bg-amber-50 text-amber-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default function AircraftPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Aircraft | null>(null);
  const [selected, setSelected] = useState<Aircraft | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [aircraftResponse, optionsResponse] = await Promise.all([
        fetch("/api/aircraft", { cache: "no-store" }),
        fetch("/api/aircraft/options", { cache: "no-store" }),
      ]);
      const aircraftData = await aircraftResponse.json();
      const optionsData = await optionsResponse.json();
      if (!aircraftResponse.ok) throw new Error(aircraftData.error || "Could not load aircraft.");
      if (!optionsResponse.ok) throw new Error(optionsData.error || "Could not load form options.");
      setAircraft(Array.isArray(aircraftData) ? aircraftData : aircraftData.aircraft ?? []);
      setModels(optionsData.models ?? []);
      setAirports(optionsData.airports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load aircraft data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredAircraft = useMemo(() => aircraft.filter((item) => {
    const matchesSearch = item.registration_no.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "ALL" || item.aircraft_status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [aircraft, search, statusFilter]);

  const dueSoonCount = aircraft.filter((item) => {
    const remaining = remainingHours(item);
    return remaining !== null && remaining <= 50;
  }).length;

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, model_id: models[0] ? String(models[0].model_id) : "", current_airport_id: airports[0] ? String(airports[0].airport_id) : "" });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEdit(item: Aircraft) {
    setEditing(item);
    setForm({
      registration_no: item.registration_no,
      model_id: String(item.model_id),
      current_airport_id: String(item.current_airport_id),
      manufacture_date: dateOnly(item.manufacture_date),
      purchase_date: dateOnly(item.purchase_date),
      total_flight_hours: String(item.total_flight_hours),
      total_flight_cycles: String(item.total_flight_cycles),
      aircraft_status: item.aircraft_status,
      last_maintenance_date: dateOnly(item.last_maintenance_date),
      next_maintenance_due_hours: item.next_maintenance_due_hours == null ? "" : String(item.next_maintenance_due_hours),
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  async function submitAircraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      registration_no: form.registration_no.trim().toUpperCase(),
      model_id: Number(form.model_id),
      current_airport_id: Number(form.current_airport_id),
      manufacture_date: form.manufacture_date,
      purchase_date: form.purchase_date,
      total_flight_hours: Number(form.total_flight_hours),
      total_flight_cycles: Number(form.total_flight_cycles),
      aircraft_status: form.aircraft_status,
      last_maintenance_date: form.last_maintenance_date || null,
      next_maintenance_due_hours: form.next_maintenance_due_hours === "" ? null : Number(form.next_maintenance_due_hours),
    };

    try {
      const response = await fetch(editing ? `/api/aircraft/${editing.aircraft_id}` : "/api/aircraft", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aircraft could not be saved.");
      setFormOpen(false);
      setSuccess(editing ? "Aircraft details updated successfully." : "Aircraft registered successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aircraft could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function viewDetails(item: Aircraft) {
    setSelected(item);
    try {
      const response = await fetch(`/api/aircraft/${item.aircraft_id}/maintenance-status`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setSelected({ ...item, ...data });
      }
    } catch {
      // Keep the aircraft record visible even if the threshold endpoint is unavailable.
    }
  }

  return (
    <OperationsShell active="/aircraft" eyebrow="FLEET OPERATIONS" title="Aircraft Management" description="Register aircraft, monitor fleet availability and track maintenance thresholds.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Aircraft", aircraft.length, "Registered fleet"],
          ["Active Aircraft", aircraft.filter((a) => a.aircraft_status === "ACTIVE").length, "Currently available"],
          ["Maintenance Alerts", dueSoonCount, "At or within 50 flight hours"],
          ["Aircraft Models", models.length, "Models configured"],
        ].map(([label, value, hint]) => (
          <Panel key={String(label)} className="!p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </Panel>
        ))}
      </div>

      {error && !formOpen && <div className="mb-5"><Notice>{error}</Notice></div>}
      {success && <div className="mb-5"><Notice kind="success">{success}</Notice></div>}

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Aircraft Register</h3>
            <p className="mt-1 text-sm text-slate-500">Search registrations, filter by status and manage aircraft records.</p>
          </div>
          <button className={primaryButton} onClick={openCreate}>+ Add Aircraft</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration number..." />
          <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="GROUNDED">Grounded</option>
            <option value="RETIRED">Retired</option>
          </select>
          <button className={secondaryButton} onClick={() => { setSearch(""); setStatusFilter("ALL"); void loadData(); }}>Reset / Refresh</button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Registration</th>
                <th className="px-3 py-3">Aircraft Model</th>
                <th className="px-3 py-3">Current Airport</th>
                <th className="px-3 py-3">Flight Hours</th>
                <th className="px-3 py-3">Maintenance</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">Loading aircraft records...</td></tr> :
                filteredAircraft.map((item) => {
                  const remaining = remainingHours(item);
                  const maintenance = maintenanceLabel(item);
                  return (
                    <tr key={item.aircraft_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-3 py-4 font-semibold">{item.registration_no}<p className="mt-1 text-xs font-normal text-slate-500">ID #{item.aircraft_id}</p></td>
                      <td className="px-3 py-4"><span className="font-medium">{item.model_name}</span><p className="mt-1 text-xs text-slate-500">{item.manufacturer}</p></td>
                      <td className="px-3 py-4">{item.current_airport_code}<p className="mt-1 text-xs text-slate-500">{item.current_airport_name}</p></td>
                      <td className="px-3 py-4 font-medium tabular-nums">{Number(item.total_flight_hours).toFixed(2)} hrs</td>
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(maintenance)}`}>{maintenance}</span><p className="mt-1 text-xs text-slate-500">{remaining === null ? "Threshold not set" : remaining.toFixed(2) + " hrs remaining"}</p></td>
                      <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.aircraft_status)}`}>{item.aircraft_status}</span></td>
                      <td className="px-3 py-4 text-right"><div className="flex justify-end gap-2"><button className="font-semibold text-sky-700 hover:text-sky-900" onClick={() => void viewDetails(item)}>View</button><button className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => openEdit(item)}>Edit</button></div></td>
                    </tr>
                  );
                })}
              {!loading && filteredAircraft.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No aircraft match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 py-8">
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Aircraft register</p><h3 className="mt-1 text-xl font-bold">{editing ? "Edit Aircraft" : "Register Aircraft"}</h3><p className="mt-1 text-sm text-slate-500">Enter the aircraft details below.</p></div>
              <button className="text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={() => setFormOpen(false)} aria-label="Close">×</button>
            </div>
            {error && <div className="mb-4"><Notice>{error}</Notice></div>}
            <form onSubmit={submitAircraft} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Registration number<input required maxLength={20} className={`${inputClass} mt-1.5`} value={form.registration_no} onChange={(e) => setForm({ ...form, registration_no: e.target.value.toUpperCase() })} placeholder="VT-ABC" /></label>
              <label className="text-sm font-medium text-slate-700">Aircraft model<select required className={`${inputClass} mt-1.5`} value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })}><option value="">Select model</option>{models.map((m) => <option key={m.model_id} value={m.model_id}>{m.manufacturer} · {m.model_name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Current airport<select required className={`${inputClass} mt-1.5`} value={form.current_airport_id} onChange={(e) => setForm({ ...form, current_airport_id: e.target.value })}><option value="">Select airport</option>{airports.map((a) => <option key={a.airport_id} value={a.airport_id}>{a.airport_code} · {a.city}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Aircraft status<select className={`${inputClass} mt-1.5`} value={form.aircraft_status} onChange={(e) => setForm({ ...form, aircraft_status: e.target.value })}><option>ACTIVE</option><option>MAINTENANCE</option><option>GROUNDED</option><option>RETIRED</option></select></label>
              <label className="text-sm font-medium text-slate-700">Manufacture date<input required type="date" className={`${inputClass} mt-1.5`} value={form.manufacture_date} onChange={(e) => setForm({ ...form, manufacture_date: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Purchase date<input required type="date" className={`${inputClass} mt-1.5`} value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Cumulative flight hours<input required min="0" step="0.01" type="number" className={`${inputClass} mt-1.5`} value={form.total_flight_hours} onChange={(e) => setForm({ ...form, total_flight_hours: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Total flight cycles<input required min="0" step="1" type="number" className={`${inputClass} mt-1.5`} value={form.total_flight_cycles} onChange={(e) => setForm({ ...form, total_flight_cycles: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Last maintenance date<input type="date" className={`${inputClass} mt-1.5`} value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Next maintenance due at (flight hours)<input min="0" step="0.01" type="number" className={`${inputClass} mt-1.5`} value={form.next_maintenance_due_hours} onChange={(e) => setForm({ ...form, next_maintenance_due_hours: e.target.value })} placeholder="e.g. 1500" /></label>
              <div className="col-span-full mt-2 flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className={secondaryButton} onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className={primaryButton} disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Register Aircraft"}</button></div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Aircraft details</p><h3 className="mt-1 text-xl font-bold">{selected.registration_no}</h3><p className="mt-1 text-sm text-slate-500">{selected.manufacturer} {selected.model_name}</p></div><button className="text-2xl text-slate-400" onClick={() => setSelected(null)}>×</button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Aircraft ID", selected.aircraft_id],
                ["Current airport", selected.current_airport_code],
                ["Aircraft status", selected.aircraft_status],
                ["Total flight cycles", selected.total_flight_cycles],
                ["Cumulative flight hours", `${Number(selected.total_flight_hours).toFixed(2)} hrs`],
                ["Next maintenance threshold", selected.next_maintenance_due_hours == null ? "Not set" : `${selected.next_maintenance_due_hours} hrs`],
                ["Remaining hours", selected.remaining_hours_until_maintenance == null ? "Not set" : `${Number(selected.remaining_hours_until_maintenance).toFixed(2)} hrs`],
                ["Maintenance status", selected.maintenance_status ?? maintenanceLabel(selected)],
              ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
            </div>
            <div className="mt-5 flex justify-end"><button className={secondaryButton} onClick={() => setSelected(null)}>Close</button></div>
          </div>
        </div>
      )}
    </OperationsShell>
  );
}
