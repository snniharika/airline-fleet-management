
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

interface CrewLicenseRow extends RowDataPacket {
  license_id: number;
  crew_id: number;
  license_type: string;
  license_number: string;
  issue_date: string;
  expiry_date: string;
  issuing_authority: string;
  status: string;
}

interface CrewRow extends RowDataPacket {
  crew_id: number;
}

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
      const parsedCrewId = Number(crewId);

      if (!Number.isSafeInteger(parsedCrewId) || parsedCrewId <= 0) {
        return NextResponse.json(
          { error: "Invalid crew ID" },
          { status: 400 }
        );
      }

      query += " WHERE crew_id = ?";
      params.push(parsedCrewId);
    }

    query += " ORDER BY expiry_date ASC";

    const [rows] = await pool.query<CrewLicenseRow[]>(query, params);

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

    const crewId = Number(crew_id);

    if (!Number.isSafeInteger(crewId) || crewId <= 0) {
      return NextResponse.json(
        { error: "Invalid crew ID" },
        { status: 400 }
      );
    }

    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

    if (
      typeof issue_date !== "string" ||
      typeof expiry_date !== "string" ||
      !dateFormat.test(issue_date) ||
      !dateFormat.test(expiry_date)
    ) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    if (expiry_date < issue_date) {
      return NextResponse.json(
        { error: "Expiry date cannot be before issue date" },
        { status: 400 }
      );
    }

    const allowedStatuses = [
      "VALID",
      "EXPIRED",
      "SUSPENDED",
      "REVOKED",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid license status" },
        { status: 400 }
      );
    }

    const [crewRows] = await pool.execute<CrewRow[]>(
      `SELECT crew_id
       FROM CREW_MEMBER
       WHERE crew_id = ?`,
      [crewId]
    );

    if (crewRows.length === 0) {
      return NextResponse.json(
        { error: "Crew member not found" },
        { status: 404 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO CREW_LICENSE
       (
         crew_id,
         license_type,
         license_number,
         issue_date,
         expiry_date,
         issuing_authority,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crewId,
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
        license_id: result.insertId,
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
