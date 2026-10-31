
"use client";

import { useEffect, useState } from "react";

type CrewMember = {
  crew_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  crew_role: string;
  hire_date: string;
  availability_status: string;
  base_airport_id: number;
  airport_code?: string;
};

type Airport = {
  airport_id: number;
  airport_code: string;
  airport_name: string;
  city: string;
};

const initialForm = {
  employee_code: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  email: "",
  crew_role: "PILOT",
  hire_date: "",
  availability_status: "AVAILABLE",
  base_airport_id: "",
};

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCrew() {
    try {
      setLoading(true);

      const response = await fetch("/api/crew");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load crew.");
      }

      setCrew(data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load crew members.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAirports() {
    try {
      const response = await fetch("/api/airports");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load airports.");
      }

      setAirports(Array.isArray(data) ? data : data.airports || []);
    } catch (err) {
      console.error("Airport loading error:", err);
      setError(
        "Could not load airports. Please check that /api/airports exists."
      );
    }
  }

  useEffect(() => {
    loadCrew();
    loadAirports();
  }, []);

  async function addCrewMember(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/crew", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to add crew member.");
      }

      setSuccess("Crew member added successfully!");
      setForm(initialForm);
      setShowForm(false);

      await loadCrew();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to add crew member."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    marginTop: "6px",
    marginBottom: "14px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
  };

  return (
    <main
      style={{
        padding: 32,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Crew Management
      </h1>

      <p style={{ color: "#64748b", marginBottom: 24 }}>
        View and manage crew members and their availability.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          onClick={loadCrew}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            cursor: "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh Crew"}
        </button>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setError("");
            setSuccess("");
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {showForm ? "Close Form" : "Add Crew Member"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addCrewMember}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            padding: 20,
            marginBottom: 24,
            maxWidth: 550,
          }}
        >
          <h2 style={{ fontSize: 22, marginBottom: 18 }}>
            Add New Crew Member
          </h2>

          <label style={labelStyle}>
            Employee Code
            <input
              style={inputStyle}
              value={form.employee_code}
              onChange={(e) =>
                setForm({ ...form, employee_code: e.target.value })
              }
              placeholder="CR005"
              required
            />
          </label>

          <label style={labelStyle}>
            First Name
            <input
              style={inputStyle}
              value={form.first_name}
              onChange={(e) =>
                setForm({ ...form, first_name: e.target.value })
              }
              required
            />
          </label>

          <label style={labelStyle}>
            Last Name
            <input
              style={inputStyle}
              value={form.last_name}
              onChange={(e) =>
                setForm({ ...form, last_name: e.target.value })
              }
              required
            />
          </label>

          <label style={labelStyle}>
            Date of Birth
            <input
              style={inputStyle}
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
              required
            />
          </label>

          <label style={labelStyle}>
            Phone Number
            <input
              style={inputStyle}
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
          </label>

          <label style={labelStyle}>
            Email Address
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              required
            />
          </label>

          <label style={labelStyle}>
            Crew Role
            <select
              style={inputStyle}
              value={form.crew_role}
              onChange={(e) =>
                setForm({ ...form, crew_role: e.target.value })
              }
            >
              <option value="PILOT">Pilot</option>
              <option value="CO_PILOT">Co-Pilot</option>
              <option value="CABIN_CREW">Cabin Crew</option>
            </select>
          </label>

          <label style={labelStyle}>
            Hire Date
            <input
              style={inputStyle}
              type="date"
              value={form.hire_date}
              onChange={(e) =>
                setForm({ ...form, hire_date: e.target.value })
              }
              required
            />
          </label>

          <label style={labelStyle}>
            Base Airport
            <select
              style={inputStyle}
              value={form.base_airport_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  base_airport_id: e.target.value,
                })
              }
              required
            >
              <option value="">Select Airport</option>

              {airports.map((airport) => (
                <option
                  key={airport.airport_id}
                  value={airport.airport_id}
                >
                  {airport.airport_code} - {airport.airport_name} ({airport.city})
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Availability
            <select
              style={inputStyle}
              value={form.availability_status}
              onChange={(e) =>
                setForm({
                  ...form,
                  availability_status: e.target.value,
                })
              }
            >
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="ASSIGNED">Assigned</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving || airports.length === 0}
            style={{
              padding: "11px 18px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Crew Member"}
          </button>
        </form>
      )}

      {error && (
        <p style={{ color: "crimson", marginBottom: 16 }}>
          {error}
        </p>
      )}

      {success && (
        <p style={{ color: "green", marginBottom: 16 }}>
          {success}
        </p>
      )}

      {loading ? (
        <p>Loading crew members...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                {[
                  "ID",
                  "Employee Code",
                  "Name",
                  "Date of Birth",
                  "Email",
                  "Role",
                  "Hire Date",
                  "Base Airport",
                  "Availability",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: 12,
                      borderBottom: "2px solid #cbd5e1",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {crew.map((member) => (
                <tr key={member.crew_id}>
                  <td style={{ padding: 12 }}>{member.crew_id}</td>
                  <td style={{ padding: 12 }}>{member.employee_code}</td>
                  <td style={{ padding: 12 }}>
                    {member.first_name} {member.last_name}
                  </td>
                  <td style={{ padding: 12 }}>
                    {String(member.date_of_birth).slice(0, 10)}
                  </td>
                  <td style={{ padding: 12 }}>{member.email}</td>
                  <td style={{ padding: 12 }}>{member.crew_role}</td>
                  <td style={{ padding: 12 }}>
                    {String(member.hire_date).slice(0, 10)}
                  </td>
                  <td style={{ padding: 12 }}>
                    {member.airport_code || member.base_airport_id}
                  </td>
                  <td style={{ padding: 12 }}>
                    {member.availability_status}
                  </td>
                </tr>
              ))}

              {crew.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 20 }}>
                    No crew members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
