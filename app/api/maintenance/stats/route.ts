
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || "airline_management";

let clientPromise: Promise<MongoClient> | null = null;

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function GET() {
  try {
    // MySQL maintenance statistics.
    const [maintenanceRows] = await pool.query(`
      SELECT
        COUNT(*) AS total_maintenance,
        SUM(CASE WHEN maintenance_status = 'SCHEDULED' THEN 1 ELSE 0 END)
          AS scheduled,
        SUM(CASE WHEN maintenance_status = 'IN_PROGRESS' THEN 1 ELSE 0 END)
          AS in_progress,
        SUM(CASE WHEN maintenance_status = 'COMPLETED' THEN 1 ELSE 0 END)
          AS completed,
        SUM(CASE WHEN maintenance_status = 'ON_HOLD' THEN 1 ELSE 0 END)
          AS on_hold,
        COALESCE(SUM(maintenance_cost), 0) AS total_maintenance_cost
      FROM MAINTENANCE
    `);

    const maintenance = (
      maintenanceRows as {
        total_maintenance: number;
        scheduled: number;
        in_progress: number;
        completed: number;
        on_hold: number;
        total_maintenance_cost: number;
      }[]
    )[0];

    // MongoDB maintenance report and finding statistics.
    const client = await getMongoClient();
    const db = client.db(DATABASE_NAME);
    const reportsCollection = db.collection("maintenance_reports");

    const totalReports = await reportsCollection.countDocuments();

    const severityResults = await reportsCollection
      .aggregate([
        { $unwind: "$findings" },
        {
          $group: {
            _id: { $toUpper: "$findings.severity" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();

    const severityCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    for (const item of severityResults) {
      if (typeof item._id === "string") {
        severityCounts[item._id] = item.count;
      }
    }

    return NextResponse.json({
      maintenance: {
        total: Number(maintenance?.total_maintenance ?? 0),
        scheduled: Number(maintenance?.scheduled ?? 0),
        in_progress: Number(maintenance?.in_progress ?? 0),
        completed: Number(maintenance?.completed ?? 0),
        on_hold: Number(maintenance?.on_hold ?? 0),
        total_cost: Number(maintenance?.total_maintenance_cost ?? 0)
      },
      reports: {
        total: totalReports,
        findings_by_severity: severityCounts
      }
    });
  } catch (error) {
    console.error("Maintenance statistics error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance statistics" },
      { status: 500 }
    );
  }
}
