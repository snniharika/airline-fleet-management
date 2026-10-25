import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedStatuses = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "ARRIVED",
  "DELAYED",
  "CANCELLED",
];

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Date.parse(value))
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const flightId = Number(id);

    if (!Number.isInteger(flightId) || flightId <= 0) {
      return NextResponse.json(
        { error: "Invalid flight ID." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        f.*,
        a.registration_no,
        am.model_name,
        dep.airport_code AS departure_airport_code,
        dep.airport_name AS departure_airport_name,
        arr.airport_code AS arrival_airport_code,
        arr.airport_name AS arrival_airport_name
      FROM flight f
      JOIN aircraft a ON f.aircraft_id = a.aircraft_id
      JOIN aircraft_model am ON a.model_id = am.model_id
      JOIN airport dep ON f.departure_airport_id = dep.airport_id
      JOIN airport arr ON f.arrival_airport_id = arr.airport_id
      WHERE f.flight_id = ?`,
      [flightId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Flight not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ flight: rows[0] });
  } catch (error) {
    console.error("Failed to fetch flight:", error);

    return NextResponse.json(
      { error: "Failed to fetch flight." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;

  try {
    const { id } = await params;
    const flightId = Number(id);

    if (!Number.isInteger(flightId) || flightId <= 0) {
      return NextResponse.json(
        { error: "Invalid flight ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const editableFields = [
      "flight_number",
      "aircraft_id",
      "departure_airport_id",
      "arrival_airport_id",
      "scheduled_departure",
      "scheduled_arrival",
      "flight_status",
    ];

    const suppliedFields = Object.keys(body).filter((key) =>
      editableFields.includes(key)
    );

    if (suppliedFields.length === 0) {
      return NextResponse.json(
        { error: "No valid flight fields were provided." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [flightRows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM flight WHERE flight_id = ? FOR UPDATE",
      [flightId]
    );

    if (flightRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Flight not found." },
        { status: 404 }
      );
    }

    const current = flightRows[0];

    if (
      current.flight_status === "ARRIVED" ||
      current.flight_status === "CANCELLED"
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Completed or cancelled flights cannot be edited." },
        { status: 409 }
      );
    }

    const updated = {
      flight_number:
        body.flight_number === undefined
          ? current.flight_number
          : typeof body.flight_number === "string"
            ? body.flight_number.trim().toUpperCase()
            : "",
      aircraft_id:
        body.aircraft_id === undefined
          ? Number(current.aircraft_id)
          : Number(body.aircraft_id),
      departure_airport_id:
        body.departure_airport_id === undefined
          ? Number(current.departure_airport_id)
          : Number(body.departure_airport_id),
      arrival_airport_id:
        body.arrival_airport_id === undefined
          ? Number(current.arrival_airport_id)
          : Number(body.arrival_airport_id),
      scheduled_departure:
        body.scheduled_departure === undefined
          ? current.scheduled_departure
          : body.scheduled_departure,
      scheduled_arrival:
        body.scheduled_arrival === undefined
          ? current.scheduled_arrival
          : body.scheduled_arrival,
      flight_status:
        body.flight_status === undefined
          ? current.flight_status
          : typeof body.flight_status === "string"
            ? body.flight_status.trim().toUpperCase()
            : "",
    };

    if (
      !updated.flight_number ||
      updated.flight_number.length > 20
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Flight number is required and cannot exceed 20 characters." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(updated.aircraft_id) ||
      updated.aircraft_id <= 0 ||
      !Number.isInteger(updated.departure_airport_id) ||
      updated.departure_airport_id <= 0 ||
      !Number.isInteger(updated.arrival_airport_id) ||
      updated.arrival_airport_id <= 0
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Aircraft and airport IDs must be positive integers." },
        { status: 400 }
      );
    }

    if (
      updated.departure_airport_id === updated.arrival_airport_id
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Departure and arrival airports must be different." },
        { status: 400 }
      );
    }

    const parseFlightDate = (value: string | Date): number => {
    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value !== "string") {
        return Number.NaN;
    }

    // MySQL DATETIME values may arrive as "2026-11-01T08:00:00.000Z"
    // or "2026-11-01 08:00:00".
    const normalized = value.trim().replace(" ", "T");
    const timestamp = Date.parse(normalized);

    return timestamp;
    };

const departureTime = parseFlightDate(updated.scheduled_departure);
const arrivalTime = parseFlightDate(updated.scheduled_arrival);

if (
  !Number.isFinite(departureTime) ||
  !Number.isFinite(arrivalTime) ||
  arrivalTime <= departureTime
) {
  await connection.rollback();
  transactionStarted = false;

  return NextResponse.json(
    { error: "Scheduled arrival must be after scheduled departure." },
    { status: 400 }
  );
}

    if (!allowedStatuses.includes(updated.flight_status)) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Invalid flight status." },
        { status: 400 }
      );
    }

    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT aircraft_id, aircraft_status
       FROM aircraft
       WHERE aircraft_id = ?
       FOR UPDATE`,
      [updated.aircraft_id]
    );

    if (aircraftRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "The selected aircraft does not exist." },
        { status: 400 }
      );
    }

    if (aircraftRows[0].aircraft_status !== "ACTIVE") {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Only ACTIVE aircraft can be scheduled." },
        { status: 400 }
      );
    }

    const [airportRows] = await connection.execute<RowDataPacket[]>(
      `SELECT airport_id
       FROM airport
       WHERE airport_id IN (?, ?)`,
      [
        updated.departure_airport_id,
        updated.arrival_airport_id,
      ]
    );

    if (airportRows.length !== 2) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "One or both selected airports do not exist." },
        { status: 400 }
      );
    }

    const [overlapRows] = await connection.execute<RowDataPacket[]>(
      `SELECT flight_id, flight_number
       FROM flight
       WHERE aircraft_id = ?
         AND flight_id <> ?
         AND flight_status NOT IN ('CANCELLED', 'ARRIVED')
         AND scheduled_departure < ?
         AND scheduled_arrival > ?
       LIMIT 1`,
      [
        updated.aircraft_id,
        flightId,
        updated.scheduled_arrival,
        updated.scheduled_departure,
      ]
    );

    if (overlapRows.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          error: "This aircraft already has an overlapping scheduled flight.",
          conflictingFlight: overlapRows[0],
        },
        { status: 409 }
      );
    }

    const toMySQLDateTime = (value: string | Date) => {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 19).replace("T", " ");
      }

      return value.replace("T", " ");
    };

    await connection.execute(
      `UPDATE flight
       SET flight_number = ?,
           aircraft_id = ?,
           departure_airport_id = ?,
           arrival_airport_id = ?,
           scheduled_departure = ?,
           scheduled_arrival = ?,
           flight_status = ?
       WHERE flight_id = ?`,
      [
        updated.flight_number,
        updated.aircraft_id,
        updated.departure_airport_id,
        updated.arrival_airport_id,
        toMySQLDateTime(updated.scheduled_departure),
        toMySQLDateTime(updated.scheduled_arrival),
        updated.flight_status,
        flightId,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    const [updatedRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM flight WHERE flight_id = ?",
      [flightId]
    );

    return NextResponse.json({
      message: "Flight updated successfully.",
      flight: updatedRows[0],
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Failed to update flight:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { error: "That flight number already exists." },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_NO_REFERENCED_ROW_2"
    ) {
      return NextResponse.json(
        { error: "The selected aircraft or airport does not exist." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update flight." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
