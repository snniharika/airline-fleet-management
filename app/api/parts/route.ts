import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        part_id,
        part_number,
        part_name,
        manufacturer,
        unit_cost,
        stock_quantity,
        reorder_level,
        part_status
      FROM MAINTENANCE_PART
      ORDER BY part_name
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch parts error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance parts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      part_number,
      part_name,
      manufacturer,
      unit_cost,
      stock_quantity,
      reorder_level,
      part_status,
    } = body;

    if (
      !part_number ||
      !part_name ||
      !manufacturer ||
      unit_cost == null ||
      stock_quantity == null ||
      reorder_level == null ||
      !part_status
    ) {
      return NextResponse.json(
        { error: "All maintenance part fields are required" },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(Number(unit_cost)) ||
      Number(unit_cost) < 0 ||
      !Number.isInteger(Number(stock_quantity)) ||
      Number(stock_quantity) < 0 ||
      !Number.isInteger(Number(reorder_level)) ||
      Number(reorder_level) < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Unit cost must be non-negative; stock and reorder level must be non-negative integers",
        },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO MAINTENANCE_PART
        (
          part_number,
          part_name,
          manufacturer,
          unit_cost,
          stock_quantity,
          reorder_level,
          part_status
        )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        part_number.trim(),
        part_name.trim(),
        manufacturer.trim(),
        Number(unit_cost),
        Number(stock_quantity),
        Number(reorder_level),
        part_status.trim(),
      ]
    );

    return NextResponse.json(
      {
        message: "Maintenance part created successfully",
        result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create part error:", error);

    return NextResponse.json(
      { error: "Failed to create maintenance part" },
      { status: 500 }
    );
  }
}