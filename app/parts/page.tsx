"use client";

import { useEffect, useState } from "react";

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

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadParts() {
    try {
      setLoading(true);

      const response = await fetch("/api/parts");

      if (!response.ok) {
        throw new Error("Could not load parts");
      }

      setParts(await response.json());
      setError("");
    } catch {
      setError("Unable to load maintenance parts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParts();
  }, []);

  const lowStockCount = parts.filter(
    (part) =>
      Number(part.stock_quantity) <= Number(part.reorder_level)
  ).length;

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700 }}>
        Maintenance Parts
      </h1>

      <p style={{ color: "#64748b", margin: "8px 0 24px" }}>
        Manage spare parts, inventory levels and reorder requirements.
      </p>

      <button
        onClick={loadParts}
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

      {!loading && !error && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: 18,
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <p style={{ color: "#64748b" }}>Total part types</p>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>
                {parts.length}
              </h2>
            </div>

            <div
              style={{
                padding: 18,
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
            >
              <p style={{ color: "#64748b" }}>Low-stock items</p>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>
                {lowStockCount}
              </h2>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
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
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
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
                {parts.map((part) => {
                  const lowStock =
                    Number(part.stock_quantity) <=
                    Number(part.reorder_level);

                  return (
                    <tr key={part.part_id}>
                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.part_id}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        <strong>{part.part_name}</strong>
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.part_number}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.manufacturer}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.stock_quantity}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.reorder_level}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        ₹{Number(part.unit_cost).toFixed(2)}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        {part.part_status}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
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
                    <td colSpan={9} style={{ padding: 20 }}>
                      No parts found in inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}