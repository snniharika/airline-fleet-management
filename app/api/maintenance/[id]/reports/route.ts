
import { NextRequest, NextResponse } from "next/server";
//import { ObjectId } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import pool from "@/lib/mysql";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID" },
        { status: 400 }
      );
    }

    const db = await getMongoDatabase();
    const reports = db.collection("maintenance_reports");
    const { searchParams } = new URL(request.url);

    // Return a count of findings grouped by severity.
    if (searchParams.get("summary") === "severity") {
      const summary = await reports.aggregate([
        { $match: { maintenance_id: maintenanceId } },
        { $unwind: "$findings" },
        {
          $group: {
            _id: "$findings.severity",
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

      return NextResponse.json({ summary });
    }

    // Optionally filter reports by severity.
    const severity = searchParams.get("severity")?.toUpperCase();
    const filter: Record<string, unknown> = {
      maintenance_id: maintenanceId
    };

    if (severity) {
      if (!VALID_SEVERITIES.includes(severity)) {
        return NextResponse.json(
          { error: "Severity must be LOW, MEDIUM, HIGH, or CRITICAL" },
          { status: 400 }
        );
      }

      filter["findings.severity"] = severity;
    }

    const results = await reports
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ reports: results });
  } catch (error) {
    console.error("GET maintenance reports failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve maintenance reports" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID" },
        { status: 400 }
      );
    }

    // Verify that the maintenance record exists in MySQL.
    const [rows] = await pool.execute(
      "SELECT maintenance_id FROM MAINTENANCE WHERE maintenance_id = ?",
      [maintenanceId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found in MySQL" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, inspector, findings, notes } = body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof inspector !== "string" ||
      !inspector.trim() ||
      !Array.isArray(findings) ||
      findings.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "title, inspector, and at least one finding are required"
        },
        { status: 400 }
      );
    }

    for (const finding of findings) {
      if (
        !finding ||
        typeof finding.description !== "string" ||
        !finding.description.trim() ||
        typeof finding.severity !== "string" ||
        !VALID_SEVERITIES.includes(finding.severity.toUpperCase())
      ) {
        return NextResponse.json(
          {
            error:
              "Each finding needs a description and a valid severity"
          },
          { status: 400 }
        );
      }
    }

    const normalizedFindings = findings.map(
      (finding: { description: string; severity: string }) => ({
        description: finding.description.trim(),
        severity: finding.severity.toUpperCase()
      })
    );

    const db = await getMongoDatabase();
    const reports = db.collection("maintenance_reports");

    // Create the collection index for maintenance report lookups.
    await reports.createIndex({ maintenance_id: 1 });

    const report = {
      maintenance_id: maintenanceId,
      title: title.trim(),
      inspector: inspector.trim(),
      findings: normalizedFindings,
      notes: typeof notes === "string" ? notes.trim() : "",
      created_at: new Date()
    };

    const result = await reports.insertOne(report);

    return NextResponse.json(
      {
        message: "Maintenance report saved",
        report: {
          _id: result.insertedId,
          ...report
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST maintenance report failed:", error);

    return NextResponse.json(
      { error: "Failed to save maintenance report" },
      { status: 500 }
    );
  }
}
