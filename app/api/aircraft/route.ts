
import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

const allowedStatuses = [
  "ACTIVE",
  "MAINTENANCE",
  "GROUNDED",
  "RETIRED",
] as const;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function GET() {
  // Both ADMIN and STAFF can view aircraft records.
  const auth = await requireApiRole(["ADMIN", "STAFF"]);

  if (auth.error) {
    return auth.error;
  }

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
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
      ORDER BY a.aircraft_id`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to retrieve aircraft:", error);

    return NextResponse.json(
      { error: "Failed to retrieve aircraft records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Only ADMIN can create aircraft records.
  const auth = await requireApiRole(["ADMIN"]);

  if (auth.error) {
    return auth.error;
  }

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

    const registrationId =
      typeof data.registration_id === "string"
        ? data.registration_id.trim().toUpperCase()
        : "";

    const modelId = Number(data.model_id);
    const airportId = Number(data.current_airport_id);

    const manufactureDate = data.manufacture_date;
    const purchaseDate = data.purchase_date;

    const totalFlightHours =
      data.total_flight_hours === undefined
        ? 0
        : Number(data.total_flight_hours);

    const totalFlightCycles =
      data.total_flight_cycles === undefined
        ? 0
        : Number(data.total_flight_cycles);

    const aircraftStatus =
      data.aircraft_status === undefined
        ? "ACTIVE"
        : typeof data.aircraft_status === "string"
          ? data.aircraft_status.trim().toUpperCase()
          : "";

    const lastMaintenanceDate =
      data.last_maintenance_date === undefined
        ? null
        : data.last_maintenance_date;

    const nextMaintenanceDueHours =
      data.next_maintenance_due_hours === undefined
        ? null
        : data.next_maintenance_due_hours;

    if (!registrationId || registrationId.length > 20) {
      return NextResponse.json(
        { error: "A valid registration ID of at most 20 characters is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(modelId) ||
      modelId <= 0 ||
      !Number.isInteger(airportId) ||
      airportId <= 0
    ) {
      return NextResponse.json(
        { error: "Model ID and airport ID must be positive integers." },
        { status: 400 }
      );
    }

    if (
      !isValidDate(manufactureDate) ||
      !isValidDate(purchaseDate)
    ) {
      return NextResponse.json(
        { error: "Valid manufacture and purchase dates in YYYY-MM-DD format are required." },
        { status: 400 }
      );
    }

    if (purchaseDate < manufactureDate) {
      return NextResponse.json(
        { error: "Purchase date cannot be earlier than manufacture date." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(totalFlightHours) ||
      totalFlightHours < 0 ||
      !Number.isInteger(totalFlightCycles) ||
      totalFlightCycles < 0
    ) {
      return NextResponse.json(
        { error: "Flight hours and flight cycles must be non-negative numbers." },
        { status: 400 }
      );
    }

    if (
      !allowedStatuses.includes(
        aircraftStatus as (typeof allowedStatuses)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid aircraft status." },
        { status: 400 }
      );
    }

    if (
      lastMaintenanceDate !== null &&
      !isValidDate(lastMaintenanceDate)
    ) {
      return NextResponse.json(
        { error: "Last maintenance date must be a valid date in YYYY-MM-DD format or null." },
        { status: 400 }
      );
    }

    const nextDueHours =
      nextMaintenanceDueHours === null
        ? null
        : Number(nextMaintenanceDueHours);

    if (
      nextDueHours !== null &&
      (!Number.isFinite(nextDueHours) || nextDueHours < 0)
    ) {
      return NextResponse.json(
        { error: "Next maintenance due hours must be a non-negative number or null." },
        { status: 400 }
      );
    }

    const [existingRows] = await pool.execute<RowDataPacket[]>(
      "SELECT aircraft_id FROM aircraft WHERE registration_id = ?",
      [registrationId]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "An aircraft with this registration ID already exists." },
        { status: 409 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
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
        registrationId,
        modelId,
        airportId,
        manufactureDate,
        purchaseDate,
        totalFlightHours,
        totalFlightCycles,
        aircraftStatus,
        lastMaintenanceDate,
        nextDueHours,
      ]
    );

    return NextResponse.json(
      {
        message: "Aircraft created successfully.",
        aircraft_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const dbError = error as { code?: string };

    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "An aircraft with this registration ID already exists." },
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
