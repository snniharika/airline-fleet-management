import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface AircraftRow extends RowDataPacket {
  aircraft_id: number;
  registration_id: string;
}

const allowedStatuses = [
  "ACTIVE",
  "MAINTENANCE",
  "GROUNDED",
  "RETIRED",
] as const;

const allowedFields = [
  "registration_id",
  "model_id",
  "current_airport_id",
  "manufacture_date",
  "purchase_date",
  "total_flight_hours",
  "total_flight_cycles",
  "aircraft_status",
  "last_maintenance_date",
  "next_maintenance_due_hours",
] as const;

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const aircraftId = Number(id);

    if (!Number.isInteger(aircraftId) || aircraftId <= 0) {
      return NextResponse.json(
        { error: "Invalid aircraft ID." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        a.aircraft_id,
        a.registration_id,
        a.model_id,
        a.current_airport_id,
        a.manufacture_date,
        a.purchase_date,
        a.total_flight_hours,
        a.total_flight_cycles,
        a.aircraft_status,
        a.last_maintenance_date,
        a.next_maintenance_due_hours,
        am.model_name,
        am.manufacturer,
        am.seat_capacity,
        am.max_flight_hours,
        am.maintenance_interval_hours,
        ap.airport_code AS current_airport_code,
        ap.airport_name AS current_airport_name
      FROM aircraft a
      JOIN aircraft_model am ON a.model_id = am.model_id
      JOIN airport ap ON a.current_airport_id = ap.airport_id
      WHERE a.aircraft_id = ?`,
      [aircraftId]
    );

    const aircraft = rows[0];

    if (!aircraft) {
      return NextResponse.json(
        { error: "Aircraft not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ aircraft });
  } catch (error) {
    console.error("Failed to fetch aircraft:", error);

    return NextResponse.json(
      { error: "Failed to fetch aircraft." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const aircraftId = Number(id);

    if (!Number.isInteger(aircraftId) || aircraftId <= 0) {
      return NextResponse.json(
        { error: "Invalid aircraft ID." },
        { status: 400 }
      );
    }

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

    const entries = Object.entries(body).filter(([key]) =>
      (allowedFields as readonly string[]).includes(key)
    );

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid aircraft fields were provided." },
        { status: 400 }
      );
    }

    const [existingRows] = await pool.execute<AircraftRow[]>(
      "SELECT aircraft_id, registration_id FROM aircraft WHERE aircraft_id = ?",
      [aircraftId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Aircraft not found." },
        { status: 404 }
      );
    }

    const normalizedEntries: [string, unknown][] = entries.map(
      ([key, value]) => {
        if (key === "registration_id" && typeof value === "string") {
          return [key, value.trim().toUpperCase()];
        }

        if (
          [
            "model_id",
            "current_airport_id",
            "total_flight_cycles",
          ].includes(key) &&
          value !== null
        ) {
          return [key, Number(value)];
        }

        if (
          [
            "total_flight_hours",
            "next_maintenance_due_hours",
          ].includes(key) &&
          value !== null
        ) {
          return [key, Number(value)];
        }

        if (key === "aircraft_status" && typeof value === "string") {
          return [key, value.trim().toUpperCase()];
        }

        return [key, value];
      }
    );

    for (const [key, value] of normalizedEntries) {
      if (
        [
          "model_id",
          "current_airport_id",
          "total_flight_cycles",
        ].includes(key) &&
        (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value <= 0 &&
          key !== "total_flight_cycles" ||
          value < 0
        )
      ) {
        return NextResponse.json(
          { error: `${key} must be a valid integer in the permitted range.` },
          { status: 400 }
        );
      }

      if (
        ["total_flight_hours", "next_maintenance_due_hours"].includes(key) &&
        value !== null &&
        (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0
        )
      ) {
        return NextResponse.json(
          { error: `${key} must be a non-negative number or null.` },
          { status: 400 }
        );
      }

      if (
        key === "aircraft_status" &&
        !allowedStatuses.includes(value as (typeof allowedStatuses)[number])
      ) {
        return NextResponse.json(
          { error: "Invalid aircraft status." },
          { status: 400 }
        );
      }

      if (
        key === "registration_id" &&
        (typeof value !== "string" || value.length === 0)
      ) {
        return NextResponse.json(
          { error: "Registration number cannot be empty." },
          { status: 400 }
        );
      }

      if (
        [
          "manufacture_date",
          "purchase_date",
          "last_maintenance_date",
        ].includes(key) &&
        value !== null &&
        (
          typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value)
        )
      ) {
        return NextResponse.json(
          { error: `${key} must be a date in YYYY-MM-DD format or null.` },
          { status: 400 }
        );
      }
    }

    const assignments = normalizedEntries.map(
      ([key]) => `\`${key}\` = ?`
    );

    const values = normalizedEntries.map(([, value]) => value);

    const updateSql: string =
      `UPDATE aircraft SET ${assignments.join(", ")} WHERE aircraft_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(
      updateSql,
      [...values, aircraftId]
    );

    if (result.affectedRows === 0) {
      const [checkRows] = await pool.execute<AircraftRow[]>(
        "SELECT aircraft_id, registration_id FROM aircraft WHERE aircraft_id = ?",
        [aircraftId]
      );

      if (checkRows.length === 0) {
        return NextResponse.json(
          { error: "Aircraft not found." },
          { status: 404 }
        );
      }
    }

    const [updatedRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM aircraft WHERE aircraft_id = ?",
      [aircraftId]
    );

    return NextResponse.json({
      message: "Aircraft updated successfully.",
      aircraft: updatedRows[0],
    });
  } catch (error: unknown) {
    console.error("Failed to update aircraft:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { error: "That registration number is already in use." },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (
        error.code === "ER_NO_REFERENCED_ROW_2" ||
        error.code === "ER_NO_REFERENCED_ROW"
      )
    ) {
      return NextResponse.json(
        { error: "The selected aircraft model or airport does not exist." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update aircraft." },
      { status: 500 }
    );
  }
}
