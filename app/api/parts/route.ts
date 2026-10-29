
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT
        part_id,
        part_name,
        part_number,
        description,
        quantity_in_stock,
        unit_cost,
        reorder_level
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
      part_name,
      part_number,
      description,
      quantity_in_stock,
      unit_cost,
      reorder_level,
    } = body;

    if (
      !part_name ||
      !part_number ||
      quantity_in_stock == null ||
      unit_cost == null ||
      reorder_level == null
    ) {
      return NextResponse.json(
        { error: "Part name, number, stock, cost and reorder level are required" },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(Number(quantity_in_stock)) ||
      Number(quantity_in_stock) < 0 ||
      !Number.isFinite(Number(unit_cost)) ||
      Number(unit_cost) < 0 ||
      !Number.isInteger(Number(reorder_level)) ||
      Number(reorder_level) < 0
    ) {
      return NextResponse.json(
        { error: "Stock and reorder level must be non-negative integers; cost must be non-negative" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO MAINTENANCE_PART
       (part_name, part_number, description, quantity_in_stock,
        unit_cost, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        part_name,
        part_number,
        description || null,
        Number(quantity_in_stock),
        Number(unit_cost),
        Number(reorder_level),
      ]
    );

    return NextResponse.json(
      { message: "Maintenance part created successfully", result },
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
