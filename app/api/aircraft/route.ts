import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";

export const runtime = "nodejs";

const allowedStatuses = [
  "ACTIVE",
  "MAINTENANCE",
  "GROUNDED",
  "RETIRED",
];

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.aircraft_id,
        a.registration_id,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      registration_id,
      model_id,
      current_airport_id,
      manufacture_date,
      purchase_date,
      total_flight_hours = 0,
      total_flight_cycles = 0,
      aircraft_status = "ACTIVE",
      last_maintenance_date = null,
      next_maintenance_due_hours = null,
    } = body;

    if (
      typeof registration_id !== "string" ||
      registration_id.trim() === "" ||
      !Number.isInteger(Number(model_id)) ||
      Number(model_id) <= 0 ||
      !Number.isInteger(Number(current_airport_id)) ||
      Number(current_airport_id) <= 0 ||
      !manufacture_date ||
      !purchase_date
    ) {
      return NextResponse.json(
        { error: "Registration, model, airport, manufacture date, and purchase date are required." },
        { status: 400 }
      );
    }

    if (
      Number(purchase_date.replaceAll("-", "")) <
      Number(manufacture_date.replaceAll("-", ""))
    ) {
      return NextResponse.json(
        { error: "Purchase date cannot be earlier than manufacture date." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(Number(total_flight_hours)) ||
      Number(total_flight_hours) < 0 ||
      !Number.isInteger(Number(total_flight_cycles)) ||
      Number(total_flight_cycles) < 0
    ) {
      return NextResponse.json(
        { error: "Flight hours and flight cycles must be non-negative numbers." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(aircraft_status)) {
      return NextResponse.json(
        { error: "Invalid aircraft status." },
        { status: 400 }
      );
    }

    if (
      next_maintenance_due_hours !== null &&
      (
        !Number.isFinite(Number(next_maintenance_due_hours)) ||
        Number(next_maintenance_due_hours) < 0
      )
    ) {
      return NextResponse.json(
        { error: "Next maintenance due hours must be non-negative." },
        { status: 400 }
      );
    }

    const [existing] = await pool.execute(
      "SELECT aircraft_id FROM aircraft WHERE registration_id = ?",
      [registration_id.trim()]
    );

    if ((existing as unknown[]).length > 0) {
      return NextResponse.json(
        { error: "An aircraft with this registration number already exists." },
        { status: 409 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO aircraft (
        registration_id,
        model_id,
        current_airport_id,
        manufacture_date,
        purchase_date,
        total_flight_hours,
        total_flight_cycles,
        aircraft_status,
        last_maintenance_date,
        next_maintenance_due_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registration_id.trim(),
        Number(model_id),
        Number(current_airport_id),
        manufacture_date,
        purchase_date,
        Number(total_flight_hours),
        Number(total_flight_cycles),
        aircraft_status,
        last_maintenance_date,
        next_maintenance_due_hours === null
          ? null
          : Number(next_maintenance_due_hours),
      ]
    );

    return NextResponse.json(
      {
        message: "Aircraft created successfully.",
        aircraft_id: (result as { insertId: number }).insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "An aircraft with this registration number already exists." },
        { status: 409 }
      );
    }

    if (
      dbError.code === "ER_NO_REFERENCED_ROW_2" ||
      dbError.code === "ER_NO_REFERENCED_ROW"
    ) {
      return NextResponse.json(
        { error: "The specified aircraft model or airport does not exist." },
        { status: 400 }
      );
    }

    console.error("Failed to create aircraft:", error);

    return NextResponse.json(
      { error: "Failed to create aircraft." },
      { status: 500 }
    );
  }
}
