
"use client";

import { useCallback, useEffect, useState } from "react";

type CrewMember = {
  crew_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  crew_role: string;
  availability_status: string;
};

type Flight = {
  flight_id: number;
  flight_number: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  flight_status: string;
};

type Assignment = {
  assignment_id: number;
  crew_id: number;
  employee_code?: string;
  first_name: string;
  last_name: string;
  flight_id: number;
  flight_number?: string;
  scheduled_departure?: string;
  scheduled_arrival?: string;
  assigned_role: string;
  assignment_status: string;
};

export default function AssignmentsPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [crewId, setCrewId] = useState("");
  const [flightId, setFlightId] = useState("");
  const [role, setRole] = useState("CAPTAIN");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [crewResponse, flightResponse, assignmentResponse] =
        await Promise.all([
          fetch("/api/crew"),
          fetch("/api/flights"),
          fetch("/api/crew/assignments"),
        ]);

      const crewData = await crewResponse.json();
      const flightData = await flightResponse.json();
      const assignmentData = await assignmentResponse.json();

      if (!crewResponse.ok) {
        throw new Error("Unable to load crew members.");
      }

      if (!flightResponse.ok) {
        throw new Error("Unable to load flights.");
      }

      if (!assignmentResponse.ok) {
        throw new Error("Unable to load assignments.");
      }

      setCrew(Array.isArray(crewData) ? crewData : []);
      setFlights(
        Array.isArray(flightData.flights) ? flightData.flights : []
      );
      setAssignments(
        Array.isArray(assignmentData) ? assignmentData : []
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load scheduling data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedCrew = crew.find(
    (member) => String(member.crew_id) === crewId
  );

  function getAvailableRoles(member: CrewMember | undefined) {
    if (!member) return [];

    if (member.crew_role === "PILOT") {
      return ["CAPTAIN", "FIRST_OFFICER"];
    }

    if (member.crew_role === "CO_PILOT") {
      return ["FIRST_OFFICER"];
    }

    if (member.crew_role === "CABIN_CREW") {
      return ["CABIN_CREW"];
    }

    return [];
  }

  async function createAssignment(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/crew/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          crew_id: Number(crewId),
          flight_id: Number(flightId),
          assigned_role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create assignment."
        );
      }

      setSuccess("Crew assigned to flight successfully!");

      setCrewId("");
      setFlightId("");
      setRole("CAPTAIN");

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create assignment."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 16,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
  };

  return (
    <main style={{ padding: 32, maxWidth: 1150, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Crew Scheduling
      </h1>

      <p style={{ color: "#64748b", marginTop: 8, marginBottom: 24 }}>
        Assign crew members to flights and manage flight assignments.
      </p>

      <button
        onClick={loadData}
        disabled={loading}
        style={{
          padding: "10px 16px",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {loading ? "Refreshing..." : "Refresh Data"}
      </button>

      <section
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          padding: 22,
          maxWidth: 550,
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
          Assign Crew to Flight
        </h2>

        <form onSubmit={createAssignment}>
          <label style={labelStyle}>
            Select Crew Member

            <select
              style={inputStyle}
              value={crewId}
              onChange={(e) => {
                setCrewId(e.target.value);
                setRole("");
              }}
              required
            >
              <option value="">Choose crew member</option>

              {crew
                .filter(
                  (member) =>
                    member.availability_status === "AVAILABLE"
                )
                .map((member) => (
                  <option
                    key={member.crew_id}
                    value={member.crew_id}
                  >
                    {member.employee_code} - {member.first_name}{" "}
                    {member.last_name} ({member.crew_role})
                  </option>
                ))}
            </select>
          </label>

          {selectedCrew && (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              Selected role: {selectedCrew.crew_role}
            </p>
          )}

          <label style={labelStyle}>
            Select Flight

            <select
              style={inputStyle}
              value={flightId}
              onChange={(e) => setFlightId(e.target.value)}
              required
            >
              <option value="">Choose flight</option>

              {flights
                .filter(
                  (flight) => flight.flight_status !== "CANCELLED"
                )
                .map((flight) => (
                  <option
                    key={flight.flight_id}
                    value={flight.flight_id}
                  >
                    {flight.flight_number} - Flight ID: {flight.flight_id}
                  </option>
                ))}
            </select>
          </label>

          <label style={labelStyle}>
            Assigned Role

            <select
              style={inputStyle}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={!selectedCrew}
            >
              <option value="">Choose role</option>

              {getAvailableRoles(selectedCrew).map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving || !selectedCrew || !flightId || !role}
            style={{
              padding: "11px 18px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {saving ? "Assigning..." : "Assign Crew"}
          </button>
        </form>
      </section>

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

      <h2 style={{ fontSize: 23, fontWeight: 600, marginBottom: 16 }}>
        Existing Crew Assignments
      </h2>

      {loading ? (
        <p>Loading assignments...</p>
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
                  "Assignment ID",
                  "Crew Member",
                  "Flight",
                  "Assigned Role",
                  "Status",
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
              {assignments.map((assignment) => (
                <tr key={assignment.assignment_id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {assignment.assignment_id}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {assignment.first_name} {assignment.last_name}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {assignment.flight_number || assignment.flight_id}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {assignment.assigned_role}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {assignment.assignment_status}
                  </td>
                </tr>
              ))}

              {assignments.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20 }}>
                    No crew assignments found.
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
