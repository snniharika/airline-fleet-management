
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_maintenance,
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END)
          AS scheduled,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END)
          AS in_progress,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)
          AS completed,
        SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END)
          AS on_hold,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)
          AS cancelled,
        COALESCE(SUM(maintenance_cost), 0) AS total_maintenance_cost
      FROM MAINTENANCE
    `);

    const [severityRows] = await pool.query(`
      SELECT
        f.severity,
        COUNT(*) AS report_count
      FROM maintenance_reports r
      JOIN maintenance_report_findings f
        ON f.report_id = r._id
      GROUP BY f.severity
    `);

    return NextResponse.json({
      maintenance: (rows as Record<string, unknown>[])[0],
      findings_by_severity: severityRows,
    });
  } catch (error) {
    console.error("Maintenance statistics error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance statistics" },
      { status: 500 }
    );
  }
}
