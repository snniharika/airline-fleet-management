
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
        { error: "crew_id, flight_id and assigned_role are required" },
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
        { error: "crew_id and flight_id must be positive integers" },
        { status: 400 }
      );
    }

    const allowedRoles = ["PILOT", "CO_PILOT", "CABIN_CREW"];

    if (!allowedRoles.includes(assigned_role)) {
      return NextResponse.json(
        { error: "Invalid crew role" },
        { status: 400 }
      );
    }

    // Prevent duplicate active assignments for the same role.
    const [existing] = await pool.execute(
      `SELECT assignment_id
       FROM CREW_ASSIGNMENT
       WHERE crew_id = ?
         AND flight_id = ?
         AND assigned_role = ?
         AND status <> 'CANCELLED'`,
      [crewId, flightId, assigned_role]
    );

    if ((existing as unknown[]).length > 0) {
      return NextResponse.json(
        { error: "This crew member already has this role on the flight" },
        { status: 409 }
      );
    }

    // Validate pilot licenses before assigning pilots.
    const requiredLicenseType =
      assigned_role === "PILOT" || assigned_role === "CO_PILOT"
        ? assigned_role
        : null;

    if (requiredLicenseType) {
      const [licenses] = await pool.execute(
        `SELECT license_id
         FROM CREW_LICENSE
         WHERE crew_id = ?
           AND license_type = ?
           AND status = 'VALID'
           AND expiry_date >= CURDATE()
           AND issue_date <= CURDATE()
         LIMIT 1`,
        [crewId, requiredLicenseType]
      );

      if ((licenses as unknown[]).length === 0) {
        return NextResponse.json(
          {
            error: `Crew member needs a valid, unexpired ${requiredLicenseType} license`,
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
        result,
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
