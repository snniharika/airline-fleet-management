
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [aircraft] = await pool.query(`
      SELECT
        aircraft_id,
        registration_id
      FROM AIRCRAFT
      ORDER BY aircraft_id
    `);

    const [maintenanceTypes] = await pool.query(`
      SELECT
        maintenance_type_id,
        type_name
      FROM MAINTENANCE_TYPE
      ORDER BY maintenance_type_id
    `);

    return NextResponse.json({
      aircraft,
      maintenanceTypes,
    });
  } catch (error) {
    console.error("Fetch maintenance options error:", error);

    return NextResponse.json(
      { error: "Failed to load aircraft and maintenance types" },
      { status: 500 }
    );
  }
}
