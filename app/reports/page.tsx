"use client";

import { useState } from "react";

type Finding = {
  date: string;
  component: string;
  observation: string;
  severity: string;
};

type Report = {
  _id?: string;
  maintenance_id: number;
  aircraft_id: number;
  report_type: string;
  technician_name: string;
  findings: Finding[];
  recommendations?: string;
  report_status: string;
  created_at?: string;
};

export default function ReportsPage() {
  const [maintenanceId, setMaintenanceId] = useState("1");
  const [severity, setSeverity] = useState("ALL");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function loadReports(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = Number(maintenanceId);

    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter a valid maintenance ID.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setLoaded(false);

      const query =
        severity === "ALL" ? "" : `?severity=${severity}`;

      const response = await fetch(
        `/api/maintenance/${id}/reports${query}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load reports.");
      }

      setReports(data.reports ?? []);
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Maintenance Reports
      </h1>

      <p style={{ color: "#64748b", margin: "8px 0 24px" }}>
        Review inspection reports and maintenance findings.
      </p>

      <form
        onSubmit={loadReports}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <input
          type="number"
          min="1"
          required
          value={maintenanceId}
          onChange={(event) => setMaintenanceId(event.target.value)}
          placeholder="Maintenance ID"
          style={{
            padding: 12,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
          }}
        />

        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          style={{
            padding: 12,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
          }}
        >
          <option value="ALL">All Severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: "#4f46e5",
            color: "white",
          }}
        >
          {loading ? "Loading..." : "Load Reports"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loaded && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            {reports.length} report(s) found
          </h2>

          {reports.length === 0 && (
            <p>No reports found for this maintenance record.</p>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {reports.map((report, index) => (
              <article
                key={report._id ?? index}
                style={{
                  padding: 20,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                }}
              >
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>
                  {report.report_type}
                </h3>

                <p style={{ marginTop: 8 }}>
                  **Maintenance ID:** {report.maintenance_id}
                </p>

                <p>**Aircraft ID:** {report.aircraft_id}</p>

                <p>**Technician:** {report.technician_name}</p>

                <p>**Status:** {report.report_status}</p>

                {report.created_at && (
                  <p>
                    **Created:**{" "}
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                )}

                <div style={{ marginTop: 18 }}>
                  <h4 style={{ fontWeight: 600 }}>Findings</h4>

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {report.findings?.map((finding, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 12,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <p>
                          <strong>{finding.component}</strong>
                        </p>

                        <p style={{ marginTop: 4 }}>
                          {finding.observation}
                        </p>

                        <p style={{ marginTop: 6, fontSize: 13 }}>
                          Date: {finding.date}
                        </p>

                        <p style={{ marginTop: 4, fontSize: 13 }}>
                          Severity: <strong>{finding.severity}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {report.recommendations && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontWeight: 600 }}>Recommendations</h4>
                    <p style={{ marginTop: 6 }}>
                      {report.recommendations}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}