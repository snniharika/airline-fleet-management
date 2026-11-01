import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Date.parse(value))
  );
}

function toMySQLDateTime(value: string): string {
  return value.replace("T", " ").slice(0, 19);
}

export async function POST(
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

    const actualDeparture = body.actual_departure;
    const actualArrival = body.actual_arrival;

    if (
      !isValidDate(actualDeparture) ||
      !isValidDate(actualArrival)
    ) {
      return NextResponse.json(
        {
          error:
            "Valid actual departure and arrival dates are required.",
        },
        { status: 400 }
      );
    }

    const departureTime = new Date(actualDeparture);
    const arrivalTime = new Date(actualArrival);

    if (arrivalTime.getTime() <= departureTime.getTime()) {
      return NextResponse.json(
        { error: "Actual arrival must be after actual departure." },
        { status: 400 }
      );
    }

    const durationHours =
      Math.round(
        ((arrivalTime.getTime() - departureTime.getTime()) /
          3600000) *
          100
      ) / 100;

    if (durationHours <= 0) {
      return NextResponse.json(
        { error: "Calculated flight duration must be positive." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [flightRows] = await connection.execute<RowDataPacket[]>(
      `SELECT *
       FROM flight
       WHERE flight_id = ?
       FOR UPDATE`,
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

    const flight = flightRows[0];

    if (flight.flight_status === "ARRIVED") {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          error:
            "This flight has already been completed. Flight hours cannot be recorded twice.",
        },
        { status: 409 }
      );
    }

    if (flight.flight_status === "CANCELLED") {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "A cancelled flight cannot be completed." },
        { status: 409 }
      );
    }

    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT aircraft_id, total_flight_hours, total_flight_cycles
       FROM aircraft
       WHERE aircraft_id = ?
       FOR UPDATE`,
      [flight.aircraft_id]
    );

    if (aircraftRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "The aircraft assigned to this flight was not found." },
        { status: 400 }
      );
    }

    const actualDepartureSQL = toMySQLDateTime(actualDeparture);
    const actualArrivalSQL = toMySQLDateTime(actualArrival);

    await connection.execute(
      `UPDATE flight
       SET actual_departure = ?,
           actual_arrival = ?,
           flight_duration = ?,
           flight_hours_recorded = ?,
           flight_status = 'ARRIVED'
       WHERE flight_id = ?`,
      [
        actualDepartureSQL,
        actualArrivalSQL,
        durationHours,
        durationHours,
        flightId,
      ]
    );

    await connection.execute(
      `UPDATE aircraft
       SET total_flight_hours = total_flight_hours + ?,
           total_flight_cycles = total_flight_cycles + 1
       WHERE aircraft_id = ?`,
      [durationHours, flight.aircraft_id]
    );

    await connection.commit();
    transactionStarted = false;

    const [updatedFlightRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM flight WHERE flight_id = ?",
      [flightId]
    );

    const [updatedAircraftRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         aircraft_id,
         registration_id,
         total_flight_hours,
         total_flight_cycles,
         next_maintenance_due_hours
       FROM aircraft
       WHERE aircraft_id = ?`,
      [flight.aircraft_id]
    );

    return NextResponse.json({
      message: "Flight completed and aircraft flight hours updated successfully.",
      flight: updatedFlightRows[0],
      aircraft: updatedAircraftRows[0],
      flight_hours_added: durationHours,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Failed to complete flight:", error);

    return NextResponse.json(
      { error: "Failed to complete flight." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
