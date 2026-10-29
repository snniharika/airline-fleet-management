
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

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
      JOIN CREW_MEMBER cm ON ca.crew_id = cm.crew_id
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

    if (!crew_id || !flight_id || !assigned_role) {
      return NextResponse.json(
        { error: "crew_id, flight_id, and assigned_role are required" },
        { status: 400 }
      );
    }

    const crewId = Number(crew_id);
    const flightId = Number(flight_id);

    if (
      !Number.isInteger(crewId) ||
      crewId <= 0 ||
      !Number.isInteger(flightId) ||
      flightId <= 0
    ) {
      return NextResponse.json(
        { error: "Crew and flight IDs must be positive integers" },
        { status: 400 }
      );
    }

    const allowedRoles = ["PILOT", "CO_PILOT", "CABIN_CREW"];

    if (
      typeof assigned_role !== "string" ||
      !allowedRoles.includes(assigned_role)
    ) {
      return NextResponse.json(
        { error: "Role must be PILOT, CO_PILOT, or CABIN_CREW" },
        { status: 400 }
      );
    }

    // Check crew existence and availability.
    const [crewRows] = await pool.execute(
      `SELECT crew_id, availability_status
       FROM CREW_MEMBER
       WHERE crew_id = ?`,
      [crewId]
    );

    const crew = (
      crewRows as {
        crew_id: number;
        availability_status: string;
      }[]
    )[0];

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

    // Retrieve the flight's scheduled time interval.
    const [flightRows] = await pool.execute(
      `SELECT flight_id, scheduled_departure, scheduled_arrival
       FROM FLIGHT
       WHERE flight_id = ?`,
      [flightId]
    );

    const flight = (
      flightRows as {
        flight_id: number;
        scheduled_departure: string | Date;
        scheduled_arrival: string | Date;
      }[]
    )[0];

    if (!flight) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    if (
      !flight.scheduled_departure ||
      !flight.scheduled_arrival ||
      new Date(flight.scheduled_arrival).getTime() <=
        new Date(flight.scheduled_departure).getTime()
    ) {
      return NextResponse.json(
        { error: "Flight has an invalid scheduled time interval" },
        { status: 400 }
      );
    }

    // Reject duplicate active assignments to the same flight.
    const [existing] = await pool.execute(
      `SELECT assignment_id
       FROM CREW_ASSIGNMENT
       WHERE crew_id = ?
         AND flight_id = ?
         AND status <> 'CANCELLED'`,
      [crewId, flightId]
    );

    if ((existing as unknown[]).length > 0) {
      return NextResponse.json(
        { error: "This crew member is already assigned to this flight" },
        { status: 409 }
      );
    }

    // Reject overlapping assignments on other flights.
    const [overlappingRows] = await pool.execute(
      `SELECT ca.assignment_id, ca.flight_id
       FROM CREW_ASSIGNMENT ca
       JOIN FLIGHT f ON f.flight_id = ca.flight_id
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

    if ((overlappingRows as unknown[]).length > 0) {
      return NextResponse.json(
        {
          error:
            "Crew member already has an assignment during this flight's scheduled time"
        },
        { status: 409 }
      );
    }

    // Validate the required pilot licence against the flight date.
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

    const [result] = await pool.execute(
      `INSERT INTO CREW_ASSIGNMENT
       (crew_id, flight_id, assigned_role, status)
       VALUES (?, ?, ?, 'ASSIGNED')`,
      [crewId, flightId, assigned_role]
    );

    return NextResponse.json(
      {
        message: "Crew assigned to flight successfully",
        result
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
