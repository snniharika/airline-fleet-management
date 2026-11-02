import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type {
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";

const ALLOWED_ROLES = [
  "CAPTAIN",
  "FIRST_OFFICER",
  "CABIN_CREW",
];

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        ca.assignment_id,
        ca.crew_id,
        cm.employee_code,
        cm.first_name,
        cm.last_name,
        ca.flight_id,
        f.flight_number,
        f.scheduled_departure,
        f.scheduled_arrival,
        ca.assigned_role,
        ca.assignment_status,
        ca.assigned_at,
        ca.hours_at_flight,
        ca.remarks
      FROM CREW_ASSIGNMENT ca
      JOIN CREW_MEMBER cm ON cm.crew_id = ca.crew_id
      JOIN FLIGHT f ON f.flight_id = ca.flight_id
      ORDER BY ca.assignment_id DESC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch crew assignments error:", error);

    return NextResponse.json(
      { error: "Failed to fetch crew assignments." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;

  try {
    const body = await request.json();

    const crewId = Number(body.crew_id);
    const flightId = Number(body.flight_id);
    const assignedRole = body.assigned_role;

    const remarks =
      typeof body.remarks === "string" && body.remarks.trim()
        ? body.remarks.trim()
        : null;

    if (
      !Number.isInteger(crewId) ||
      crewId <= 0 ||
      !Number.isInteger(flightId) ||
      flightId <= 0 ||
      typeof assignedRole !== "string"
    ) {
      return NextResponse.json(
        { error: "Select a crew member, flight and role." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(assignedRole)) {
      return NextResponse.json(
        { error: "Invalid assignment role." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the crew member so simultaneous assignment requests
    // for this person must wait for the first transaction.
    const [crewRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         crew_id,
         crew_role,
         availability_status,
         total_flight_hours
       FROM CREW_MEMBER
       WHERE crew_id = ?
       FOR UPDATE`,
      [crewId]
    );

    if (crewRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Crew member not found." },
        { status: 404 }
      );
    }

    const crew = crewRows[0];

    if (crew.availability_status !== "AVAILABLE") {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "This crew member is not available." },
        { status: 409 }
      );
    }

    if (
      (assignedRole === "CAPTAIN" && crew.crew_role !== "PILOT") ||
      (assignedRole === "FIRST_OFFICER" &&
        !["PILOT", "CO_PILOT"].includes(crew.crew_role)) ||
      (assignedRole === "CABIN_CREW" &&
        crew.crew_role !== "CABIN_CREW")
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          error:
            "Selected crew member is not qualified for this role.",
        },
        { status: 400 }
      );
    }

    const [flightRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         flight_id,
         scheduled_departure,
         scheduled_arrival,
         flight_status
       FROM FLIGHT
       WHERE flight_id = ?`,
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

    if (
      flight.flight_status === "CANCELLED" ||
      flight.flight_status === "ARRIVED"
    ) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        { error: "Cannot assign crew to a cancelled or completed flight." },
        { status: 409 }
      );
    }

    if (
      assignedRole === "CAPTAIN" ||
      assignedRole === "FIRST_OFFICER"
    ) {
      const requiredLicense = "PILOT_LICENSE";

      const [licenseRows] = await connection.execute<RowDataPacket[]>(
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
          requiredLicense,
          flight.scheduled_departure,
          flight.scheduled_departure,
        ]
      );

      if (licenseRows.length === 0) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            error: `A valid ${requiredLicense} licence is required on the flight date.`,
          },
          { status: 400 }
        );
      }
    }

    // Prevent duplicate assignments even if the role differs.
    const [duplicateRows] = await connection.execute<RowDataPacket[]>(
      `SELECT assignment_id
       FROM CREW_ASSIGNMENT
       WHERE crew_id = ?
         AND flight_id = ?
         AND assignment_status <> 'CANCELLED'
       LIMIT 1`,
      [crewId, flightId]
    );

    if (duplicateRows.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          error: "This crew member is already assigned to this flight.",
        },
        { status: 409 }
      );
    }

    const [overlapRows] = await connection.execute<RowDataPacket[]>(
      `SELECT ca.assignment_id
       FROM CREW_ASSIGNMENT ca
       JOIN FLIGHT f ON f.flight_id = ca.flight_id
       WHERE ca.crew_id = ?
         AND ca.assignment_status IN ('ASSIGNED', 'CONFIRMED')
         AND f.scheduled_departure < ?
         AND f.scheduled_arrival > ?
       LIMIT 1`,
      [
        crewId,
        flight.scheduled_arrival,
        flight.scheduled_departure,
      ]
    );

    if (overlapRows.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return NextResponse.json(
        {
          error:
            "This crew member has another overlapping flight assignment.",
        },
        { status: 409 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO CREW_ASSIGNMENT
       (
         crew_id,
         flight_id,
         assigned_role,
         assignment_status,
         hours_at_flight,
         remarks
       )
       VALUES (?, ?, ?, 'ASSIGNED', ?, ?)`,
      [
        crewId,
        flightId,
        assignedRole,
        crew.total_flight_hours,
        remarks,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json(
      {
        message: "Crew assigned successfully.",
        assignment_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (connection && transactionStarted) {
      await connection.rollback();
      transactionStarted = false;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { error: "This crew assignment already exists." },
        { status: 409 }
      );
    }

    console.error("Create crew assignment error:", error);

    return NextResponse.json(
      { error: "Failed to create crew assignment." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
