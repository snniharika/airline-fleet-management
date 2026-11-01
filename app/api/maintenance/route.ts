
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID" },
        { status: 400 }
      );
    }

    const [rows]: any = await pool.execute(
      `SELECT
         m.maintenance_id,
         m.aircraft_id,
         m.maintenance_type_id,
         mt.type_name,
         m.scheduled_start,
         m.scheduled_end,
         m.actual_start,
         m.actual_end,
         m.flight_hours_at_service,
         m.maintenance_status,
         m.priority,
         m.technician_name,
         m.cost,
         m.remarks
       FROM MAINTENANCE m
       JOIN MAINTENANCE_TYPE mt
         ON m.maintenance_type_id = mt.maintenance_type_id
       WHERE m.maintenance_id = ?`,
      [maintenanceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Fetch maintenance record error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance record" },
      { status: 500 }
    );
  }
}
