import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [models] = await pool.query<RowDataPacket[]>(
      `SELECT model_id, model_name, manufacturer, seat_capacity,
              max_flight_hours, maintenance_interval_hours, minimum_crew_required
       FROM aircraft_model
       ORDER BY manufacturer, model_name`
    );

    const [airports] = await pool.query<RowDataPacket[]>(
      `SELECT airport_id, airport_code, airport_name, city, country
       FROM airport
       ORDER BY airport_code`
    );

    return NextResponse.json({ models, airports });
  } catch (error) {
    console.error("Failed to load aircraft form options:", error);
    return NextResponse.json(
      { error: "Could not load aircraft models and airports." },
      { status: 500 }
    );
  }
}
