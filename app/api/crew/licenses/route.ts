
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const crewId = searchParams.get("crew_id");

    let query = `
      SELECT
        license_id,
        crew_id,
        license_type,
        license_number,
        issue_date,
        expiry_date,
        issuing_authority,
        status
      FROM CREW_LICENSE
    `;

    const params: (string | number)[] = [];

    if (crewId) {
      query += " WHERE crew_id = ?";
      params.push(crewId);
    }

    query += " ORDER BY expiry_date ASC";

    const [rows] = await pool.query(query, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch crew licenses error:", error);

    return NextResponse.json(
      { error: "Failed to fetch crew licenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      crew_id,
      license_type,
      license_number,
      issue_date,
      expiry_date,
      issuing_authority,
      status = "VALID",
    } = body;

    if (
      !crew_id ||
      !license_type ||
      !license_number ||
      !issue_date ||
      !expiry_date ||
      !issuing_authority
    ) {
      return NextResponse.json(
        { error: "All license fields are required" },
        { status: 400 }
      );
    }

    if (new Date(expiry_date) < new Date(issue_date)) {
      return NextResponse.json(
        { error: "Expiry date cannot be before issue date" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["VALID", "EXPIRED", "SUSPENDED", "REVOKED"];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid license status" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO CREW_LICENSE
       (crew_id, license_type, license_number, issue_date,
        expiry_date, issuing_authority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crew_id,
        license_type,
        license_number,
        issue_date,
        expiry_date,
        issuing_authority,
        status,
      ]
    );

    return NextResponse.json(
      {
        message: "Crew license created successfully",
        result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create crew license error:", error);

    return NextResponse.json(
      { error: "Failed to create crew license" },
      { status: 500 }
    );
  }
}
