
"use client";

import { useState } from "react";

type Finding = {
  severity: string;
  description: string;
};

type Report = {
  _id?: string;
  title?: string;
  inspector?: string;
  notes?: string;
  findings?: Finding[];
  created_at?: string;
};

export default function ReportsPage() {
  const [maintenanceId, setMaintenanceId] = useState("1");
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

      const response = await fetch(`/api/maintenance/${id}/reports`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load reports.");
      }

      const reportList = Array.isArray(data)
        ? data
        : data.reports ?? [];

      setReports(reportList);
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
        Review inspection reports and maintenance findings by maintenance ID.
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
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  {report.title || "Inspection Report"}
                </h3>

                {report.inspector && (
                  <p style={{ marginTop: 8 }}>
                    Inspector: {report.inspector}
                  </p>
                )}

                {report.notes && (
                  <p style={{ marginTop: 8 }}>{report.notes}</p>
                )}

                {report.findings && report.findings.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontWeight: 600 }}>Findings</h4>

                    <ul style={{ paddingLeft: 24, marginTop: 8 }}>
                      {report.findings.map((finding, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          <strong>{finding.severity}:</strong>{" "}
                          {finding.description}
                        </li>
                      ))}
                    </ul>
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
