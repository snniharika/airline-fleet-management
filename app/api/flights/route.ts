import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

const allowedStatuses = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "ARRIVED",
  "DELAYED",
  "CANCELLED",
];

type FlightRow = RowDataPacket & {
  flight_id: number;
  flight_number: string;
  aircraft_id: number;
  departure_airport_id: number;
  arrival_airport_id: number;
  scheduled_departure: string;
  scheduled_arrival: string;
  flight_status: string;
};

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Date.parse(value))
  );
}

export async function GET() {
  try {
    const [rows] = await pool.execute(
      `SELECT
        f.flight_id,
        f.flight_number,
        f.aircraft_id,
        a.registration_id,
        am.model_name,
        f.departure_airport_id,
        dep.airport_code AS departure_airport_code,
        dep.airport_name AS departure_airport_name,
        f.arrival_airport_id,
        arr.airport_code AS arrival_airport_code,
        arr.airport_name AS arrival_airport_name,
        f.scheduled_departure,
        f.scheduled_arrival,
        f.actual_departure,
        f.actual_arrival,
        f.flight_duration,
        f.flight_hours_recorded,
        f.flight_status
      FROM flight f
      JOIN aircraft a ON f.aircraft_id = a.aircraft_id
      JOIN aircraft_model am ON a.model_id = am.model_id
      JOIN airport dep ON f.departure_airport_id = dep.airport_id
      JOIN airport arr ON f.arrival_airport_id = arr.airport_id
      ORDER BY f.scheduled_departure ASC`
    );

    return NextResponse.json({ flights: rows });
  } catch (error) {
    console.error("Failed to fetch flights:", error);

    return NextResponse.json(
      { error: "Failed to fetch flights." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();

    const flightNumber =
      typeof body.flight_number === "string"
        ? body.flight_number.trim().toUpperCase()
        : "";

    const aircraftId = Number(body.aircraft_id);
    const departureAirportId = Number(body.departure_airport_id);
    const arrivalAirportId = Number(body.arrival_airport_id);

    const scheduledDeparture = body.scheduled_departure;
    const scheduledArrival = body.scheduled_arrival;

    const flightStatus =
      typeof body.flight_status === "string"
        ? body.flight_status.trim().toUpperCase()
        : "SCHEDULED";

    if (!flightNumber) {
      return NextResponse.json(
        { error: "Flight number is required." },
        { status: 400 }
      );
    }

    if (flightNumber.length > 20) {
      return NextResponse.json(
        { error: "Flight number cannot exceed 20 characters." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(aircraftId) ||
      aircraftId <= 0 ||
      !Number.isInteger(departureAirportId) ||
      departureAirportId <= 0 ||
      !Number.isInteger(arrivalAirportId) ||
      arrivalAirportId <= 0
    ) {
      return NextResponse.json(
        { error: "Aircraft ID and airport IDs must be positive integers." },
        { status: 400 }
      );
    }

    if (departureAirportId === arrivalAirportId) {
      return NextResponse.json(
        { error: "Departure and arrival airports must be different." },
        { status: 400 }
      );
    }

    if (
      !isValidDate(scheduledDeparture) ||
      !isValidDate(scheduledArrival)
    ) {
      return NextResponse.json(
        { error: "Valid scheduled departure and arrival dates are required." },
        { status: 400 }
      );
    }

    const departureTime = new Date(scheduledDeparture);
    const arrivalTime = new Date(scheduledArrival);

    if (arrivalTime.getTime() <= departureTime.getTime()) {
      return NextResponse.json(
        { error: "Scheduled arrival must be after scheduled departure." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(flightStatus)) {
      return NextResponse.json(
        { error: "Invalid flight status." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT aircraft_id, aircraft_status
       FROM aircraft
       WHERE aircraft_id = ?
       FOR UPDATE`,
      [aircraftId]
    );

    if (aircraftRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "The selected aircraft does not exist." },
        { status: 400 }
      );
    }

    if (aircraftRows[0].aircraft_status !== "ACTIVE") {
      await connection.rollback();

      return NextResponse.json(
        { error: "Only ACTIVE aircraft can be scheduled." },
        { status: 400 }
      );
    }

    const [airportRows] = await connection.execute<RowDataPacket[]>(
      `SELECT airport_id
       FROM airport
       WHERE airport_id IN (?, ?)`,
      [departureAirportId, arrivalAirportId]
    );

    if (airportRows.length !== 2) {
      await connection.rollback();

      return NextResponse.json(
        { error: "One or both selected airports do not exist." },
        { status: 400 }
      );
    }

    const [overlapRows] = await connection.execute<RowDataPacket[]>(
      `SELECT flight_id, flight_number
       FROM flight
       WHERE aircraft_id = ?
         AND flight_status NOT IN ('CANCELLED', 'ARRIVED')
         AND scheduled_departure < ?
         AND scheduled_arrival > ?
       LIMIT 1`,
      [aircraftId, scheduledArrival, scheduledDeparture]
    );

    if (overlapRows.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          error: "This aircraft already has an overlapping scheduled flight.",
          conflictingFlight: overlapRows[0],
        },
        { status: 409 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO flight (
        flight_number,
        aircraft_id,
        departure_airport_id,
        arrival_airport_id,
        scheduled_departure,
        scheduled_arrival,
        flight_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        flightNumber,
        aircraftId,
        departureAirportId,
        arrivalAirportId,
        scheduledDeparture.replace("T", " "),
        scheduledArrival.replace("T", " "),
        flightStatus,
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Flight scheduled successfully.",
        flight_id: result.insertId,
        flight_number: flightNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Failed to schedule flight:", error);

    return NextResponse.json(
      { error: "Failed to schedule flight." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
