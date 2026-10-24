import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.aircraft_id,
        a.registration_no,
        a.model_id,
        am.model_name,
        am.manufacturer,
        a.current_airport_id,
        ap.airport_code AS current_airport_code,
        ap.airport_name AS current_airport_name,
        a.manufacture_date,
        a.purchase_date,
        a.total_flight_hours,
        a.total_flight_cycles,
        a.aircraft_status,
        a.last_maintenance_date,
        a.next_maintenance_due_hours,
        am.maintenance_interval_hours
      FROM aircraft a
      INNER JOIN aircraft_model am
        ON a.model_id = am.model_id
      INNER JOIN airport ap
        ON a.current_airport_id = ap.airport_id
      ORDER BY a.aircraft_id
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
