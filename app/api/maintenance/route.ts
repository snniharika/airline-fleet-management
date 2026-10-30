
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
        m.status,
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
        { error: "Aircraft, maintenance type and schedule dates are required" },
        { status: 400 }
      );
    }

    if (new Date(scheduled_end) <= new Date(scheduled_start)) {
      return NextResponse.json(
        { error: "Scheduled end must be later than scheduled start" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO MAINTENANCE
       (aircraft_id, maintenance_type_id, scheduled_start,
        scheduled_end, description, status, maintenance_cost)
       VALUES (?, ?, ?, ?, ?, 'SCHEDULED', 0)`,
      [
        aircraft_id,
        maintenance_type_id,
        scheduled_start,
        scheduled_end,
        description || null,
      ]
    );

    return NextResponse.json(
      {
        message: "Maintenance scheduled successfully",
        result,
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
