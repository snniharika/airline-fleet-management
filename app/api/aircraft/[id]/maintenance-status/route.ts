import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const aircraftId = Number(id);

    if (!Number.isInteger(aircraftId) || aircraftId <= 0) {
      return NextResponse.json(
        { error: "Invalid aircraft ID." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         aircraft_id,
         registration_no,
         aircraft_status,
         total_flight_hours,
         next_maintenance_due_hours
       FROM aircraft
       WHERE aircraft_id = ?`,
      [aircraftId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aircraft not found." },
        { status: 404 }
      );
    }

    const aircraft = rows[0];

    const totalHours = Number(aircraft.total_flight_hours);

    const maintenanceDueHours =
      aircraft.next_maintenance_due_hours === null
        ? null
        : Number(aircraft.next_maintenance_due_hours);

    let maintenanceStatus: string;
    let remainingHours: number | null;

    if (maintenanceDueHours === null) {
      maintenanceStatus = "NOT_SET";
      remainingHours = null;
    } else {
      remainingHours = Number(
        (maintenanceDueHours - totalHours).toFixed(2)
      );

      if (remainingHours <= 0) {
        maintenanceStatus = "OVERDUE";
      } else if (remainingHours <= 50) {
        maintenanceStatus = "DUE_SOON";
      } else {
        maintenanceStatus = "OK";
      }
    }

    return NextResponse.json({
      aircraft_id: aircraft.aircraft_id,
      registration_no: aircraft.registration_no,
      aircraft_status: aircraft.aircraft_status,
      total_flight_hours: totalHours,
      next_maintenance_due_hours: maintenanceDueHours,
      remaining_hours_until_maintenance: remainingHours,
      maintenance_status: maintenanceStatus,
    });
  } catch (error) {
    console.error("Failed to calculate maintenance status:", error);

    return NextResponse.json(
      { error: "Failed to calculate maintenance status." },
      { status: 500 }
    );
  }
}
