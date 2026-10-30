
"use client";

import { useEffect, useState } from "react";

type CrewMember = {
  crew_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  crew_role: string;
  availability_status: string;
};

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCrew() {
    try {
      setLoading(true);
      const response = await fetch("/api/crew");

      if (!response.ok) {
        throw new Error("Could not load crew members");
      }

      setCrew(await response.json());
      setError("");
    } catch {
      setError("Unable to load crew. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCrew();
  }, []);

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Crew Management
      </h1>
      <p style={{ color: "#64748b", marginTop: 8, marginBottom: 24 }}>
        View crew members and their current availability.
      </p>

      <button
        onClick={loadCrew}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          marginBottom: 20,
          cursor: "pointer",
        }}
      >
        Refresh crew
      </button>

      {loading && <p>Loading crew members...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!loading && !error && (
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
                {["ID", "Employee Code", "Name", "Role", "Availability"].map(
                  (heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: 12,
                        borderBottom: "2px solid #cbd5e1",
                      }}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {crew.map((member) => (
                <tr key={member.crew_id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {member.crew_id}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {member.employee_code}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {member.first_name} {member.last_name}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {member.crew_role}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                    {member.availability_status}
                  </td>
                </tr>
              ))}
              {crew.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20 }}>
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
