
"use client";

import { useCallback, useEffect, useState } from "react";

type Part = {
  part_id: number;
  part_number: string;
  part_name: string;
  manufacturer: string;
  unit_cost: number;
  stock_quantity: number;
  reorder_level: number;
  part_status: string;
};

type Maintenance = {
  maintenance_id: number;
  registration_id: string;
  type_name: string;
  maintenance_status: string;
  cost: number;
};

type Usage = {
  usage_id: number;
  maintenance_id: number;
  part_id: number;
  part_name: string;
  part_number: string;
  quantity_used: number;
  unit_cost_at_usage: number;
  total_cost: number;
  replacement_reason: string;
};

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);

  const [selectedMaintenance, setSelectedMaintenance] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [partsResponse, maintenanceResponse] = await Promise.all([
        fetch("/api/parts"),
        fetch("/api/maintenance"),
      ]);

      if (!partsResponse.ok || !maintenanceResponse.ok) {
        throw new Error("Could not load data");
      }

      const partsData = await partsResponse.json();
      const maintenanceData = await maintenanceResponse.json();

      setParts(partsData);
      setMaintenance(maintenanceData);

      if (!selectedPart && partsData.length > 0) {
        setSelectedPart(String(partsData[0].part_id));
      }
    } catch {
      setError("Unable to load inventory or maintenance records.");
    } finally {
      setLoading(false);
    }
  }, [selectedPart]);

  const loadUsage = useCallback(async (maintenanceId: string) => {
    if (!maintenanceId) {
      setUsages([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/maintenance/${maintenanceId}/parts`
      );

      if (!response.ok) {
        throw new Error("Could not load usage history");
      }

      setUsages(await response.json());
    } catch {
      setError("Unable to load part usage history.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsage(selectedMaintenance);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedMaintenance, loadUsage]);

  const currentPart = parts.find(
    (part) => String(part.part_id) === selectedPart
  );

  const currentMaintenance = maintenance.find(
    (record) =>
      String(record.maintenance_id) === selectedMaintenance
  );

  const numericQuantity = Number(quantity);

  const estimatedCost =
    currentPart &&
    Number.isInteger(numericQuantity) &&
    numericQuantity > 0
      ? Number(currentPart.unit_cost) * numericQuantity
      : 0;

  const lowStockCount = parts.filter(
    (part) =>
      Number(part.stock_quantity) <= Number(part.reorder_level)
  ).length;

  async function recordUsage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedMaintenance || !selectedPart) {
      setError("Select a maintenance record and a part.");
      return;
    }

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity <= 0
    ) {
      setError("Enter a valid positive quantity.");
      return;
    }

    if (!reason.trim()) {
      setError("Enter the replacement reason.");
      return;
    }

    if (
      !currentPart ||
      numericQuantity > Number(currentPart.stock_quantity)
    ) {
      setError("Requested quantity exceeds available stock.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/maintenance/${selectedMaintenance}/parts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            part_id: Number(selectedPart),
            quantity_used: numericQuantity,
            replacement_reason: reason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to record part usage.");
      }

      setSuccess(
        `Part usage recorded. Total cost: ₹${Number(
          result.total_cost
        ).toFixed(2)}`
      );

      setQuantity("1");
      setReason("");

      await loadData();
      await loadUsage(selectedMaintenance);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record part usage."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Maintenance Parts
      </h1>

      <p style={{ color: "#64748b", margin: "8px 0 24px" }}>
        Manage spare parts, inventory levels and maintenance part usage.
      </p>

      <button
        onClick={loadData}
        style={{
          padding: "10px 16px",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          marginBottom: 20,
          cursor: "pointer",
        }}
      >
        Refresh inventory
      </button>

      {loading && <p>Loading inventory...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "#15803d" }}>{success}</p>}

      {!loading && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div style={cardStyle}>
              <p style={{ color: "#64748b" }}>Total part types</p>
              <h2 style={numberStyle}>{parts.length}</h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#64748b" }}>Low-stock items</p>
              <h2 style={numberStyle}>{lowStockCount}</h2>
            </div>
          </div>

          <section style={sectionStyle}>
            <h2 style={headingStyle}>Record Part Usage</h2>

            <form onSubmit={recordUsage}>
              <label style={labelStyle}>Maintenance Record</label>
              <select
                value={selectedMaintenance}
                onChange={(e) => setSelectedMaintenance(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="">Select maintenance record</option>
                {maintenance
                  .filter((record) =>
                    ["SCHEDULED", "IN_PROGRESS"].includes(
                      record.maintenance_status
                    )
                  )
                  .map((record) => (
                    <option
                      key={record.maintenance_id}
                      value={record.maintenance_id}
                    >
                      #{record.maintenance_id} - {record.registration_id}
                      {" - "}{record.type_name}
                      {" ("}{record.maintenance_status}{")"}
                    </option>
                  ))}
              </select>

              <label style={labelStyle}>Maintenance Part</label>
              <select
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="">Select part</option>
                {parts.map((part) => (
                  <option
                    key={part.part_id}
                    value={part.part_id}
                    disabled={Number(part.stock_quantity) <= 0}
                  >
                    {part.part_name} ({part.part_number}) - Stock:{" "}
                    {part.stock_quantity}
                  </option>
                ))}
              </select>

              <label style={labelStyle}>Quantity Used</label>
              <input
                type="number"
                min="1"
                max={currentPart?.stock_quantity ?? undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={inputStyle}
              />

              <label style={labelStyle}>Replacement Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for replacing the part"
                required
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />

              {currentPart && (
                <div style={{ margin: "16px 0", color: "#334155" }}>
                  <p>
                    Available stock:{" "}
                    <strong>{currentPart.stock_quantity}</strong>
                  </p>
                  <p>
                    Unit cost:{" "}
                    <strong>
                      ₹{Number(currentPart.unit_cost).toFixed(2)}
                    </strong>
                  </p>
                  <p>
                    Estimated total:{" "}
                    <strong>₹{estimatedCost.toFixed(2)}</strong>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={buttonStyle}
              >
                {saving ? "Recording..." : "Record Part Usage"}
              </button>
            </form>

            {currentMaintenance && (
              <p style={{ marginTop: 16, color: "#64748b" }}>
                Current maintenance cost: ₹
                {Number(currentMaintenance.cost).toFixed(2)}
              </p>
            )}
          </section>

          {selectedMaintenance && (
            <section style={sectionStyle}>
              <h2 style={headingStyle}>Part Usage History</h2>

              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {[
                        "Part",
                        "Part Number",
                        "Quantity",
                        "Unit Cost",
                        "Total Cost",
                        "Reason",
                      ].map((heading) => (
                        <th key={heading} style={cellStyle}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usages.map((usage) => (
                      <tr key={usage.usage_id}>
                        <td style={cellStyle}>{usage.part_name}</td>
                        <td style={cellStyle}>{usage.part_number}</td>
                        <td style={cellStyle}>{usage.quantity_used}</td>
                        <td style={cellStyle}>
                          ₹{Number(usage.unit_cost_at_usage).toFixed(2)}
                        </td>
                        <td style={cellStyle}>
                          ₹{Number(usage.total_cost).toFixed(2)}
                        </td>
                        <td style={cellStyle}>
                          {usage.replacement_reason}
                        </td>
                      </tr>
                    ))}

                    {usages.length === 0 && (
                      <tr>
                        <td colSpan={6} style={cellStyle}>
                          No parts recorded for this maintenance.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section style={sectionStyle}>
            <h2 style={headingStyle}>Inventory</h2>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "ID",
                      "Part",
                      "Part Number",
                      "Manufacturer",
                      "Stock",
                      "Reorder Level",
                      "Unit Cost",
                      "Part Status",
                      "Stock Status",
                    ].map((heading) => (
                      <th key={heading} style={cellStyle}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {parts.map((part) => {
                    const lowStock =
                      Number(part.stock_quantity) <=
                      Number(part.reorder_level);

                    return (
                      <tr key={part.part_id}>
                        <td style={cellStyle}>{part.part_id}</td>
                        <td style={cellStyle}>
                          <strong>{part.part_name}</strong>
                        </td>
                        <td style={cellStyle}>{part.part_number}</td>
                        <td style={cellStyle}>{part.manufacturer}</td>
                        <td style={cellStyle}>{part.stock_quantity}</td>
                        <td style={cellStyle}>{part.reorder_level}</td>
                        <td style={cellStyle}>
                          ₹{Number(part.unit_cost).toFixed(2)}
                        </td>
                        <td style={cellStyle}>{part.part_status}</td>
                        <td style={cellStyle}>
                          <span
                            style={{
                              color: lowStock ? "#dc2626" : "#15803d",
                            }}
                          >
                            {lowStock ? "LOW STOCK" : "IN STOCK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {parts.length === 0 && (
                    <tr>
                      <td colSpan={9} style={cellStyle}>
                        No parts found in inventory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const cardStyle = {
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
};

const numberStyle = {
  fontSize: 24,
  fontWeight: 700,
};

const sectionStyle = {
  padding: 20,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  marginBottom: 24,
};

const headingStyle = {
  fontSize: 21,
  fontWeight: 700,
  marginBottom: 18,
};

const labelStyle = {
  display: "block",
  fontWeight: 600,
  marginTop: 14,
  marginBottom: 6,
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  fontSize: 14,
};

const buttonStyle = {
  padding: "11px 18px",
  border: "none",
  borderRadius: 8,
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const cellStyle = {
  textAlign: "left" as const,
  padding: 12,
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
};
