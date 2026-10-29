
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT
         crew_id,
         employee_code,
         first_name,
         last_name,
         crew_role,
         availability_status
       FROM CREW_MEMBER
       ORDER BY crew_id`
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
        crew_role,
        availability_status,
      } = body;
  
      if (
        !employee_code ||
        !first_name ||
        !last_name ||
        !crew_role ||
        !availability_status
      ) {
        return NextResponse.json(
          { error: "All crew fields are required" },
          { status: 400 }
        );
      }
  
      const [result] = await pool.execute(
        `INSERT INTO CREW_MEMBER
         (employee_code, first_name, last_name, crew_role, availability_status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          employee_code,
          first_name,
          last_name,
          crew_role,
          availability_status,
        ]
      );
  
      return NextResponse.json(
        {
          message: "Crew member created successfully",
          result,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Create crew member error:", error);
  
      return NextResponse.json(
        { error: "Failed to create crew member" },
        { status: 500 }
      );
    }
  }
  