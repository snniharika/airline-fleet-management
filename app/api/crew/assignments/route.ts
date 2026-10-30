
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

const ALLOWED_ROLES = ["PILOT", "CO_PILOT", "CABIN_CREW"];

type CrewRow = {
  crew_id: number;
  first_name?: string;
  last_name?: string;
  availability_status: string;
};

type FlightRow = {
  flight_id: number;
  scheduled_departure: string | Date;
  scheduled_arrival: string | Date;
};

function validDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        ca.assignment_id,
        ca.crew_id,
        cm.first_name,
        cm.last_name,
        cm.availability_status,
        ca.flight_id,
        ca.assigned_role,
        ca.status
      FROM CREW_ASSIGNMENT ca
      JOIN CREW_MEMBER cm
        ON cm.crew_id = ca.crew_id
      ORDER BY ca.assignment_id DESC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch crew assignments error:", error);

    return NextResponse.json(
      { error: "Failed to fetch crew assignments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { crew_id, flight_id, assigned_role } = body;

    // 1. Validate required fields.
    if (
      crew_id === undefined ||
      crew_id === null ||
      crew_id === "" ||
      flight_id === undefined ||
      flight_id === null ||
      flight_id === "" ||
      !assigned_role
    ) {
      return NextResponse.json(
        { error: "crew_id, flight_id, and assigned_role are required" },
        { status: 400 }
      );
    }

    // 2. Validate IDs.
    const crewId = Number(crew_id);
    const flightId = Number(flight_id);

    if (
      !Number.isSafeInteger(crewId) ||
      crewId <= 0 ||
      !Number.isSafeInteger(flightId) ||
      flightId <= 0
    ) {
      return NextResponse.json(
        { error: "Crew ID and flight ID must be positive integers" },
        { status: 400 }
      );
    }

    // 3. Validate the assigned role.
    if (
      typeof assigned_role !== "string" ||
      !ALLOWED_ROLES.includes(assigned_role)
    ) {
      return NextResponse.json(
        { error: "Role must be PILOT, CO_PILOT, or CABIN_CREW" },
        { status: 400 }
      );
    }

    // 4. Check crew existence and availability.
    const [crewRows] = await pool.execute(
      `SELECT crew_id, first_name, last_name, availability_status
       FROM CREW_MEMBER
       WHERE crew_id = ?`,
      [crewId]
    );

    const crew = (crewRows as CrewRow[])[0];

    if (!crew) {
      return NextResponse.json(
        { error: "Crew member not found" },
        { status: 404 }
      );
    }

    if (crew.availability_status !== "AVAILABLE") {
      return NextResponse.json(
        { error: "Crew member is not available for assignment" },
        { status: 409 }
      );
    }

    // 5. Check that the flight exists and has valid scheduled times.
    const [flightRows] = await pool.execute(
      `SELECT flight_id, scheduled_departure, scheduled_arrival
       FROM FLIGHT
       WHERE flight_id = ?`,
      [flightId]
    );

    const flight = (flightRows as FlightRow[])[0];

    if (!flight) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    const departure = validDate(flight.scheduled_departure);
    const arrival = validDate(flight.scheduled_arrival);

    if (
      Number.isNaN(departure.getTime()) ||
      Number.isNaN(arrival.getTime()) ||
      arrival.getTime() <= departure.getTime()
    ) {
      return NextResponse.json(
        { error: "Flight has invalid scheduled departure or arrival times" },
        { status: 400 }
      );
    }

    // 6. Prevent duplicate active assignments to the same flight.
    const [duplicateRows] = await pool.execute(
      `SELECT assignment_id
       FROM CREW_ASSIGNMENT
       WHERE crew_id = ?
         AND flight_id = ?
         AND status <> 'CANCELLED'
       LIMIT 1`,
      [crewId, flightId]
    );

    if ((duplicateRows as unknown[]).length > 0) {
      return NextResponse.json(
        { error: "Crew member is already assigned to this flight" },
        { status: 409 }
      );
    }

    // 7. Prevent overlapping assignments on other flights.
    // Intervals overlap when existing departure < new arrival
    // and existing arrival > new departure.
    const [overlapRows] = await pool.execute(
      `SELECT ca.assignment_id, ca.flight_id
       FROM CREW_ASSIGNMENT ca
       JOIN FLIGHT f
         ON f.flight_id = ca.flight_id
       WHERE ca.crew_id = ?
         AND ca.status IN ('ASSIGNED', 'CONFIRMED')
         AND ca.flight_id <> ?
         AND f.scheduled_departure < ?
         AND f.scheduled_arrival > ?
       LIMIT 1`,
      [
        crewId,
        flightId,
        flight.scheduled_arrival,
        flight.scheduled_departure
      ]
    );

    if ((overlapRows as unknown[]).length > 0) {
      return NextResponse.json(
        {
          error:
            "Crew member already has an assignment during this flight's scheduled time"
        },
        { status: 409 }
      );
    }

    // 8. Validate the licence for pilots and co-pilots.
    const requiredLicenseType =
      assigned_role === "PILOT" || assigned_role === "CO_PILOT"
        ? assigned_role
        : null;

    if (requiredLicenseType) {
      const [licenseRows] = await pool.execute(
        `SELECT license_id
         FROM CREW_LICENSE
         WHERE crew_id = ?
           AND license_type = ?
           AND status = 'VALID'
           AND issue_date <= DATE(?)
           AND expiry_date >= DATE(?)
         LIMIT 1`,
        [
          crewId,
          requiredLicenseType,
          flight.scheduled_departure,
          flight.scheduled_departure
        ]
      );

      if ((licenseRows as unknown[]).length === 0) {
        return NextResponse.json(
          {
            error:
              `Crew member needs a valid ${requiredLicenseType} licence on the flight date`
          },
          { status: 400 }
        );
      }
    }

    // 9. Create the assignment.
    const [result] = await pool.execute(
      `INSERT INTO CREW_ASSIGNMENT
       (crew_id, flight_id, assigned_role, status)
       VALUES (?, ?, ?, 'ASSIGNED')`,
      [crewId, flightId, assigned_role]
    );

    return NextResponse.json(
      {
        message: "Crew assigned to flight successfully",
        assignment: result
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create crew assignment error:", error);

    return NextResponse.json(
      { error: "Failed to create crew assignment" },
      { status: 500 }
    );
  }
}
