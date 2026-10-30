import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        aircraft_id,
        registration_no,
        model_id,
        current_airport_id,
        total_flight_hours,
        aircraft_status
      FROM aircraft
      ORDER BY aircraft_id
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to retrieve aircraft:", error);

    return NextResponse.json(
      { error: "Failed to retrieve aircraft records" },
      { status: 500 }
    );
  }
}
