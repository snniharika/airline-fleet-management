import { NextRequest, NextResponse } from "next/server";
import { getMongoDatabase } from "@/lib/mongodb";
import pool from "@/lib/mysql";


type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_REPORT_STATUSES = ["SUBMITTED", "REVIEWED", "APPROVED", "REJECTED"];

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json({ error: "Invalid maintenance ID" }, { status: 400 });
    }

    const db = await getMongoDatabase();
    const reports = db.collection("maintenance_reports");
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity")?.toUpperCase();

    if (severity && !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: "Severity must be LOW, MEDIUM, HIGH, or CRITICAL" },
        { status: 400 }
      );
    }

    if (searchParams.get("summary") === "severity") {
      const summary = await reports.aggregate([
        { $match: { maintenance_id: maintenanceId } },
        { $unwind: "$findings" },
        {
          $group: {
            _id: { $toUpper: "$findings.severity" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray();

      return NextResponse.json({ summary });
    }

    const pipeline: object[] = [
      { $match: { maintenance_id: maintenanceId } },
    ];

    if (severity) {
      pipeline.push({
        $set: {
          findings: {
            $filter: {
              input: "$findings",
              as: "finding",
              cond: {
                $eq: [{ $toUpper: "$$finding.severity" }, severity],
              },
            },
          },
        },
      });
    }

    pipeline.push({ $sort: { created_at: -1 } });

    const results = await reports.aggregate(pipeline).toArray();

    return NextResponse.json({ reports: results });
  } catch (error) {
    console.error("GET maintenance reports failed:", error);
    return NextResponse.json(
      { error: "Failed to retrieve maintenance reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json({ error: "Invalid maintenance ID" }, { status: 400 });
    }

    const [rows] = await pool.execute(
      `SELECT maintenance_id, aircraft_id
       FROM MAINTENANCE
       WHERE maintenance_id = ?`,
      [maintenanceId]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found in MySQL" },
        { status: 404 }
      );
    }

    const maintenance = (rows as {
      maintenance_id: number;
      aircraft_id: number;
    }[])[0];

    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const {
      report_type,
      technician_name,
      findings,
      recommendations,
      report_status,
    } = data;

    if (
      typeof report_type !== "string" ||
      !report_type.trim() ||
      typeof technician_name !== "string" ||
      !technician_name.trim() ||
      !Array.isArray(findings) ||
      findings.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "report_type, technician_name, and at least one finding are required",
        },
        { status: 400 }
      );
    }

    for (const finding of findings) {
      if (
        !finding ||
        typeof finding !== "object" ||
        typeof finding.date !== "string" ||
        Number.isNaN(Date.parse(finding.date)) ||
        typeof finding.component !== "string" ||
        !finding.component.trim() ||
        typeof finding.observation !== "string" ||
        !finding.observation.trim() ||
        typeof finding.severity !== "string" ||
        !VALID_SEVERITIES.includes(finding.severity.toUpperCase())
      ) {
        return NextResponse.json(
          {
            error:
              "Each finding requires a valid date, component, observation, and severity",
          },
          { status: 400 }
        );
      }
    }

    if (
      recommendations != null &&
      typeof recommendations !== "string"
    ) {
      return NextResponse.json(
        { error: "recommendations must be a string" },
        { status: 400 }
      );
    }

    const normalizedStatus =
      typeof report_status === "string" && report_status.trim()
        ? report_status.trim().toUpperCase()
        : "SUBMITTED";

    if (!VALID_REPORT_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json(
        {
          error:
            "report_status must be SUBMITTED, REVIEWED, APPROVED, or REJECTED",
        },
        { status: 400 }
      );
    }

    const normalizedFindings = findings.map((finding) => ({
      date: finding.date,
      component: finding.component.trim(),
      observation: finding.observation.trim(),
      severity: finding.severity.toUpperCase(),
    }));

    const report = {
      maintenance_id: maintenanceId,
      aircraft_id: maintenance.aircraft_id,
      report_type: report_type.trim(),
      technician_name: technician_name.trim(),
      findings: normalizedFindings,
      recommendations:
        typeof recommendations === "string"
          ? recommendations.trim()
          : "",
      report_status: normalizedStatus,
      created_at: new Date(),
    };

    const db = await getMongoDatabase();
    const result = await db
      .collection("maintenance_reports")
      .insertOne(report);

    return NextResponse.json(
      {
        message: "Maintenance report saved",
        report: { _id: result.insertedId, ...report },
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
