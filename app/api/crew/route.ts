
import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "@/lib/mysql";

function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.crew_id,
        c.employee_code,
        c.first_name,
        c.last_name,
        c.date_of_birth,
        c.phone,
        c.email,
        c.crew_role,
        c.hire_date,
        c.total_flight_hours,
        c.monthly_flight_hours,
        c.availability_status,
        c.base_airport_id,
        a.airport_code
      FROM CREW_MEMBER c
      LEFT JOIN AIRPORT a
        ON c.base_airport_id = a.airport_id
      ORDER BY c.crew_id`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Crew API error:", error);

    return NextResponse.json(
      { error: "Failed to fetch crew members" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      employee_code,
      first_name,
      last_name,
      date_of_birth,
      phone,
      email,
      crew_role,
      hire_date,
      base_airport_id,
      availability_status,
    } = body;

    if (
      !employee_code ||
      !first_name ||
      !last_name ||
      !date_of_birth ||
      !email ||
      !crew_role ||
      !hire_date ||
      !base_airport_id
    ) {
      return NextResponse.json(
        { error: "Please fill in all required fields." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const allowedRoles = [
      "PILOT",
      "CO_PILOT",
      "CABIN_CREW",
    ];

    if (!allowedRoles.includes(crew_role)) {
      return NextResponse.json(
        { error: "Invalid crew role." },
        { status: 400 }
      );
    }

    const allowedAvailability = [
      "AVAILABLE",
      "UNAVAILABLE",
      "ON_LEAVE",
      "ASSIGNED",
    ];

    const availability = availability_status || "AVAILABLE";

    if (!allowedAvailability.includes(availability)) {
      return NextResponse.json(
        { error: "Invalid availability status." },
        { status: 400 }
      );
    }

    if (new Date(hire_date) <= new Date(date_of_birth)) {
      return NextResponse.json(
        { error: "Hire date must be after date of birth." },
        { status: 400 }
      );
    }

    const airportId = Number(base_airport_id);

    if (!Number.isInteger(airportId) || airportId <= 0) {
      return NextResponse.json(
        { error: "Please select a valid base airport." },
        { status: 400 }
      );
    }

    const [airportRows] = await pool.execute<RowDataPacket[]>(
      "SELECT airport_id FROM AIRPORT WHERE airport_id = ?",
      [airportId]
    );

    if (airportRows.length === 0) {
      return NextResponse.json(
        { error: "Selected airport does not exist." },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO CREW_MEMBER
       (
         employee_code,
         first_name,
         last_name,
         date_of_birth,
         phone,
         email,
         crew_role,
         hire_date,
         availability_status,
         base_airport_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_code.trim(),
        first_name.trim(),
        last_name.trim(),
        date_of_birth,
        phone || null,
        email.trim(),
        crew_role,
        hire_date,
        availability,
        airportId,
      ]
    );

    return NextResponse.json(
      {
        message: "Crew member created successfully",
        crew_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Create crew member error:", error);

    if (isDuplicateEntryError(error)) {
      return NextResponse.json(
        { error: "Employee code or email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create crew member" },
      { status: 500 }
    );
  }
}
