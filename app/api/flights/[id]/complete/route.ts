import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type {
  PoolConnection,
  RowDataPacket,
} from "mysql2/promise";

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

    // Lock the flight to prevent duplicate completion.
    const [flightRows] = await connection.execute<RowDataPacket[]>(
      `SELECT *
       FROM FLIGHT
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

    // Lock aircraft before updating its accumulated hours.
    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT aircraft_id, total_flight_hours, total_flight_cycles
       FROM AIRCRAFT
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

    // Get active crew assignments for this flight.
    const [assignmentRows] =
      await connection.execute<RowDataPacket[]>(
        `SELECT assignment_id, crew_id
         FROM CREW_ASSIGNMENT
         WHERE flight_id = ?
           AND assignment_status IN ('ASSIGNED', 'CONFIRMED')
         FOR UPDATE`,
        [flightId]
      );

    const crewIds = [
      ...new Set(
        assignmentRows.map((assignment) => Number(assignment.crew_id))
      ),
    ];

    const actualDepartureSQL = toMySQLDateTime(actualDeparture);
    const actualArrivalSQL = toMySQLDateTime(actualArrival);

    // Record the flight completion.
    await connection.execute(
      `UPDATE FLIGHT
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

    // Update aircraft hours and flight cycles.
    await connection.execute(
      `UPDATE AIRCRAFT
       SET total_flight_hours = total_flight_hours + ?,
           total_flight_cycles = total_flight_cycles + 1
       WHERE aircraft_id = ?`,
      [durationHours, flight.aircraft_id]
    );

    // Mark this flight's active crew assignments as completed.
    await connection.execute(
      `UPDATE CREW_ASSIGNMENT
       SET assignment_status = 'COMPLETED'
       WHERE flight_id = ?
         AND assignment_status IN ('ASSIGNED', 'CONFIRMED')`,
      [flightId]
    );

    // Update each assigned crew member exactly once.
    for (const crewId of crewIds) {
      await connection.execute(
        `UPDATE CREW_MEMBER
         SET total_flight_hours = total_flight_hours + ?,
             monthly_flight_hours = (
               SELECT COALESCE(SUM(f.flight_hours_recorded), 0)
               FROM CREW_ASSIGNMENT ca
               JOIN FLIGHT f ON f.flight_id = ca.flight_id
               WHERE ca.crew_id = ?
                 AND ca.assignment_status = 'COMPLETED'
                 AND f.flight_status = 'ARRIVED'
                 AND f.actual_departure >=
                     DATE_FORMAT(CURDATE(), '%Y-%m-01')
                 AND f.actual_departure <
                     DATE_ADD(
                       DATE_FORMAT(CURDATE(), '%Y-%m-01'),
                       INTERVAL 1 MONTH
                     )
             )
         WHERE crew_id = ?`,
        [durationHours, crewId, crewId]
      );
    }

    await connection.commit();
    transactionStarted = false;

    const [updatedFlightRows] =
      await connection.execute<RowDataPacket[]>(
        "SELECT * FROM FLIGHT WHERE flight_id = ?",
        [flightId]
      );

    const [updatedAircraftRows] =
      await connection.execute<RowDataPacket[]>(
        `SELECT
           aircraft_id,
           registration_id,
           total_flight_hours,
           total_flight_cycles,
           next_maintenance_due_hours
         FROM AIRCRAFT
         WHERE aircraft_id = ?`,
        [flight.aircraft_id]
      );

    const updatedCrewRows =
      crewIds.length > 0
        ? (
            await connection.execute<RowDataPacket[]>(
              `SELECT
                 crew_id,
                 total_flight_hours,
                 monthly_flight_hours
               FROM CREW_MEMBER
               WHERE crew_id IN (${crewIds.map(() => "?").join(",")})`,
              crewIds
            )
          )[0]
        : [];

    return NextResponse.json({
      message:
        "Flight completed. Aircraft and assigned crew flight hours updated successfully.",
      flight: updatedFlightRows[0],
      aircraft: updatedAircraftRows[0],
      crew: updatedCrewRows,
      flight_hours_added: durationHours,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
      transactionStarted = false;
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
