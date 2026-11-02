
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

// GET: Fetch all maintenance records
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
        m.maintenance_status,
        m.description,
        m.maintenance_cost
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

// POST: Schedule maintenance for an aircraft
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      aircraft_id,
      maintenance_type_id,
      scheduled_start,
      scheduled_end,
      description,
    } = body;

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

    const aircraftId = Number(aircraft_id);
    const maintenanceTypeId = Number(maintenance_type_id);

    if (
      !Number.isSafeInteger(aircraftId) ||
      aircraftId <= 0 ||
      !Number.isSafeInteger(maintenanceTypeId) ||
      maintenanceTypeId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid aircraft or maintenance type ID" },
        { status: 400 }
      );
    }

    if (
      typeof scheduled_start !== "string" ||
      typeof scheduled_end !== "string"
    ) {
      return NextResponse.json(
        { error: "Schedule dates must be valid date strings" },
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

    // Check whether the aircraft exists
    const [aircraftRows]: any = await pool.execute(
      `SELECT aircraft_id
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

    // Check whether the maintenance type exists
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

    // Prevent overlapping maintenance for the same aircraft
    const [overlapRows]: any = await pool.execute(
      `SELECT maintenance_id
       FROM MAINTENANCE
       WHERE aircraft_id = ?
         AND maintenance_status NOT IN ('CANCELLED', 'COMPLETED')
         AND scheduled_start < ?
         AND scheduled_end > ?
       LIMIT 1`,
      [aircraftId, mysqlEnd, mysqlStart]
    );

    if (overlapRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "This aircraft already has maintenance scheduled during this time.",
        },
        { status: 409 }
      );
    }

    // Create the maintenance schedule
    const [result]: any = await pool.execute(
      `INSERT INTO MAINTENANCE
       (
         aircraft_id,
         maintenance_type_id,
         scheduled_start,
         scheduled_end,
         description,
         maintenance_status,
         maintenance_cost
       )
       VALUES (?, ?, ?, ?, ?, 'SCHEDULED', 0)`,
      [
        aircraftId,
        maintenanceTypeId,
        mysqlStart,
        mysqlEnd,
        description?.trim() || null,
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
