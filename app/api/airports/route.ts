import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        airport_id,
        airport_code,
        airport_name,
        city,
        country,
        timezone,
        terminal_count
      FROM airport
      ORDER BY airport_code
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to retrieve airports:", error);

    return NextResponse.json(
      { error: "Failed to retrieve airport records." },
      { status: 500 }
    );
  }
}
