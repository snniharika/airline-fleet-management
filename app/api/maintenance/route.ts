import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function toMysqlDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value.trim().replace("T", " ").slice(0, 19);
}

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        m.maintenance_id,
        m.aircraft_id,
        a.registration_id,
        m.maintenance_type_id,
        mt.type_name,
        m.scheduled_start,
        m.scheduled_end,
        m.actual_start,
        m.actual_end,
        m.flight_hours_at_service,
        m.maintenance_status,
        m.priority,
        m.technician_name,
        m.cost,
        m.remarks
      FROM MAINTENANCE m
      JOIN AIRCRAFT a
        ON a.aircraft_id = m.aircraft_id
      JOIN MAINTENANCE_TYPE mt
        ON mt.maintenance_type_id = m.maintenance_type_id
      ORDER BY m.scheduled_start DESC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch maintenance records error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const aircraftId = Number(data.aircraft_id);
    const maintenanceTypeId = Number(data.maintenance_type_id);
    const scheduledStart = toMysqlDateTime(data.scheduled_start);
    const scheduledEnd = toMysqlDateTime(data.scheduled_end);
    const priority =
      typeof data.priority === "string"
        ? data.priority.toUpperCase()
        : "MEDIUM";

    if (
      !Number.isInteger(aircraftId) ||
      aircraftId <= 0 ||
      !Number.isInteger(maintenanceTypeId) ||
      maintenanceTypeId <= 0 ||
      !scheduledStart ||
      !scheduledEnd
    ) {
      return NextResponse.json(
        {
          error:
            "Valid aircraft, maintenance type, scheduled start and scheduled end are required.",
        },
        { status: 400 }
      );
    }

    if (!allowedPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid maintenance priority." },
        { status: 400 }
      );
    }

    if (
      data.technician_name != null &&
      typeof data.technician_name !== "string"
    ) {
      return NextResponse.json(
        { error: "Technician name must be a string." },
        { status: 400 }
      );
    }

    if (
      data.remarks != null &&
      typeof data.remarks !== "string"
    ) {
      return NextResponse.json(
        { error: "Maintenance remarks must be a string." },
        { status: 400 }
      );
    }

    if (new Date(data.scheduled_end as string) <= new Date(data.scheduled_start as string)) {
      return NextResponse.json(
        { error: "Scheduled end must be later than scheduled start." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the aircraft so concurrent requests cannot both schedule
    // overlapping maintenance for the same aircraft.
    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT aircraft_id, total_flight_hours, aircraft_status
       FROM AIRCRAFT
       WHERE aircraft_id = ?
       FOR UPDATE`,
      [aircraftId]
    );

    if (aircraftRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Aircraft not found." },
        { status: 404 }
      );
    }

    if (aircraftRows[0].aircraft_status === "RETIRED") {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance cannot be scheduled for a retired aircraft." },
        { status: 409 }
      );
    }

    const [typeRows] = await connection.execute<RowDataPacket[]>(
      `SELECT maintenance_type_id
       FROM MAINTENANCE_TYPE
       WHERE maintenance_type_id = ?`,
      [maintenanceTypeId]
    );

    if (typeRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance type not found." },
        { status: 404 }
      );
    }

    const [overlappingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT maintenance_id
       FROM MAINTENANCE
       WHERE aircraft_id = ?
         AND maintenance_status NOT IN ('CANCELLED', 'COMPLETED')
         AND scheduled_start < ?
         AND scheduled_end > ?
       LIMIT 1`,
      [aircraftId, scheduledEnd, scheduledStart]
    );

    if (overlappingRows.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          error:
            "This aircraft already has maintenance scheduled during this time.",
        },
        { status: 409 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO MAINTENANCE (
        aircraft_id,
        maintenance_type_id,
        scheduled_start,
        scheduled_end,
        flight_hours_at_service,
        maintenance_status,
        priority,
        technician_name,
        cost,
        remarks
      )
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, 0, ?)`,
      [
        aircraftId,
        maintenanceTypeId,
        scheduledStart,
        scheduledEnd,
        aircraftRows[0].total_flight_hours,
        priority,
        typeof data.technician_name === "string"
          ? data.technician_name.trim() || null
          : null,
        typeof data.remarks === "string"
          ? data.remarks.trim() || null
          : null,
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Maintenance scheduled successfully.",
        maintenance_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Create maintenance error:", error);

    return NextResponse.json(
      { error: "Failed to schedule maintenance." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
