
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.maintenance_id,
        m.aircraft_id,
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
      JOIN MAINTENANCE_TYPE mt
        ON m.maintenance_type_id = mt.maintenance_type_id
      ORDER BY m.scheduled_start DESC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch maintenance error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance records" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      aircraft_id,
      maintenance_type_id,
      scheduled_start,
      scheduled_end,
      priority = "MEDIUM",
      technician_name,
      remarks,
    } = body;

    const aircraftId = Number(aircraft_id);
    const maintenanceTypeId = Number(maintenance_type_id);

    if (
      !aircraft_id ||
      !maintenance_type_id ||
      !scheduled_start ||
      !scheduled_end
    ) {
      return NextResponse.json(
        {
          error:
            "Aircraft, maintenance type and schedule dates are required",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(aircraftId) ||
      aircraftId <= 0 ||
      !Number.isInteger(maintenanceTypeId) ||
      maintenanceTypeId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid aircraft or maintenance type ID" },
        { status: 400 }
      );
    }

    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) {
      return NextResponse.json(
        { error: "Invalid maintenance priority" },
        { status: 400 }
      );
    }

    if (
      technician_name != null &&
      typeof technician_name !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid technician name" },
        { status: 400 }
      );
    }

    if (remarks != null && typeof remarks !== "string") {
      return NextResponse.json(
        { error: "Invalid maintenance remarks" },
        { status: 400 }
      );
    }

    const startDate = new Date(scheduled_start);
    const endDate = new Date(scheduled_end);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Invalid maintenance schedule dates" },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "Scheduled end must be later than scheduled start" },
        { status: 400 }
      );
    }

    const [aircraftRows]: any = await pool.execute(
      `SELECT aircraft_id, total_flight_hours
       FROM AIRCRAFT
       WHERE aircraft_id = ?`,
      [aircraftId]
    );

    if (aircraftRows.length === 0) {
      return NextResponse.json(
        { error: "Aircraft not found" },
        { status: 404 }
      );
    }

    const [typeRows]: any = await pool.execute(
      `SELECT maintenance_type_id
       FROM MAINTENANCE_TYPE
       WHERE maintenance_type_id = ?`,
      [maintenanceTypeId]
    );

    if (typeRows.length === 0) {
      return NextResponse.json(
        { error: "Maintenance type not found" },
        { status: 404 }
      );
    }

    const mysqlStart = scheduled_start.replace("T", " ");
    const mysqlEnd = scheduled_end.replace("T", " ");

    const [overlappingRows]: any = await pool.execute(
      `SELECT maintenance_id
       FROM MAINTENANCE
       WHERE aircraft_id = ?
         AND maintenance_status NOT IN ('CANCELLED', 'COMPLETED')
         AND scheduled_start < ?
         AND scheduled_end > ?
       LIMIT 1`,
      [aircraftId, mysqlEnd, mysqlStart]
    );

    if (overlappingRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "This aircraft already has maintenance scheduled during this time.",
        },
        { status: 409 }
      );
    }

    const flightHoursAtService = Number(
      aircraftRows[0].total_flight_hours
    );

    const [result]: any = await pool.execute(
      `INSERT INTO MAINTENANCE
       (
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
        mysqlStart,
        mysqlEnd,
        flightHoursAtService,
        priority,
        technician_name?.trim() || null,
        remarks?.trim() || null,
      ]
    );

    return NextResponse.json(
      {
        message: "Maintenance scheduled successfully",
        maintenance_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create maintenance error:", error);

    return NextResponse.json(
      { error: "Failed to create maintenance record" },
      { status: 500 }
    );
  }
}
