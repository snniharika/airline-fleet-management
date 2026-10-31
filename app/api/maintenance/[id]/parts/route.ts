
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT
         u.usage_id,
         u.maintenance_id,
         u.part_id,
         p.part_name,
         p.part_number,
         u.quantity_used,
         u.unit_cost_at_usage,
         u.quantity_used * u.unit_cost_at_usage AS total_cost,
         u.used_at
       FROM MAINTENANCE_PART_USAGE u
       JOIN MAINTENANCE_PART p ON p.part_id = u.part_id
       WHERE u.maintenance_id = ?
       ORDER BY u.used_at DESC`,
      [maintenanceId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Fetch part usage error:", error);

    return NextResponse.json(
      { error: "Failed to fetch parts used" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  let connection;

  try {
    const { id } = await params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const partId = Number(body.part_id);
    const quantity = Number(body.quantity_used);

    if (
      !Number.isInteger(partId) ||
      partId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error: "Valid part_id and positive integer quantity_used are required",
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [maintenanceRows] = await connection.execute(
      `SELECT maintenance_status
       FROM MAINTENANCE
       WHERE maintenance_id = ?
       FOR UPDATE`,
      [maintenanceId]
    );

    const maintenance = maintenanceRows as {
      maintenance_status: string;
    }[];

    if (maintenance.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      );
    }

    if (
      !["SCHEDULED", "IN_PROGRESS"].includes(
        maintenance[0].maintenance_status
      )
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          error:
            "Parts can only be recorded for scheduled or in-progress maintenance",
        },
        { status: 409 }
      );
    }

    const [partRows] = await connection.execute(
      `SELECT quantity_in_stock, unit_cost
       FROM MAINTENANCE_PART
       WHERE part_id = ?
       FOR UPDATE`,
      [partId]
    );

    const parts = partRows as {
      quantity_in_stock: number;
      unit_cost: number;
    }[];

    if (parts.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance part not found" },
        { status: 404 }
      );
    }

    const availableStock = Number(parts[0].quantity_in_stock);

    if (availableStock < quantity) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Insufficient part stock" },
        { status: 409 }
      );
    }

    const unitCost = Number(parts[0].unit_cost);
    const totalCost = quantity * unitCost;

    await connection.execute(
      `INSERT INTO MAINTENANCE_PART_USAGE
       (maintenance_id, part_id, quantity_used, unit_cost_at_usage)
       VALUES (?, ?, ?, ?)`,
      [maintenanceId, partId, quantity, unitCost]
    );

    await connection.execute(
      `UPDATE MAINTENANCE_PART
       SET quantity_in_stock = quantity_in_stock - ?
       WHERE part_id = ?`,
      [quantity, partId]
    );

    await connection.execute(
      `UPDATE MAINTENANCE
       SET maintenance_cost = maintenance_cost + ?
       WHERE maintenance_id = ?`,
      [totalCost, maintenanceId]
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Part usage recorded successfully",
        maintenance_id: maintenanceId,
        part_id: partId,
        quantity_used: quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Record part usage error:", error);

    return NextResponse.json(
      { error: "Failed to record part usage" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
