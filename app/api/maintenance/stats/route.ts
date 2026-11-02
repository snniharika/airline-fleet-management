
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/mysql";
import { getMongoDatabase } from "@/lib/mongodb";

interface MaintenanceStatsRow extends RowDataPacket {
  total_maintenance: number;
  scheduled: number | null;
  in_progress: number | null;
  completed: number | null;
  on_hold: number | null;
  total_maintenance_cost: number;
}

interface SeverityResult {
  _id: string;
  count: number;
}

export async function GET() {
  let maintenance;

  try {
    const [rows] = await pool.query<MaintenanceStatsRow[]>(`
      SELECT
        COUNT(*) AS total_maintenance,
        SUM(CASE WHEN maintenance_status = 'SCHEDULED' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN maintenance_status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN maintenance_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN maintenance_status = 'ON_HOLD' THEN 1 ELSE 0 END) AS on_hold,
        COALESCE(SUM(cost), 0) AS total_maintenance_cost
      FROM MAINTENANCE
    `);

    const row = rows[0];

    maintenance = {
      total: Number(row?.total_maintenance ?? 0),
      scheduled: Number(row?.scheduled ?? 0),
      in_progress: Number(row?.in_progress ?? 0),
      completed: Number(row?.completed ?? 0),
      on_hold: Number(row?.on_hold ?? 0),
      total_cost: Number(row?.total_maintenance_cost ?? 0),
    };
  } catch (error) {
    console.error("MySQL maintenance statistics error:", error);

    return NextResponse.json(
      { error: "Failed to fetch MySQL maintenance statistics" },
      { status: 500 }
    );
  }

  try {
    const db = await getMongoDatabase();
    const reportsCollection = db.collection("maintenance_reports");

    const totalReports = await reportsCollection.countDocuments();

    const severityResults = await reportsCollection
      .aggregate<SeverityResult>([
        { $unwind: "$findings" },
        {
          $group: {
            _id: { $toUpper: "$findings.severity" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const severityCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const item of severityResults) {
      if (item._id in severityCounts) {
        severityCounts[item._id] = item.count;
      }
    }

    return NextResponse.json({
      maintenance,
      reports: {
        available: true,
        total: totalReports,
        findings_by_severity: severityCounts,
      },
    });
  } catch (error) {
    console.error("MongoDB maintenance statistics error:", error);

    return NextResponse.json({
      maintenance,
      reports: {
        available: false,
        error: "MongoDB report statistics are currently unavailable.",
      },
    });
  }
}
