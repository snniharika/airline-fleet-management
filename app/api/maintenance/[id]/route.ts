import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedTransitions: Record<string, string[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED", "ON_HOLD"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        m.maintenance_id,
        m.aircraft_id,
        a.registration_id,
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
      JOIN AIRCRAFT a
        ON a.aircraft_id = m.aircraft_id
      JOIN MAINTENANCE_TYPE mt
        ON mt.maintenance_type_id = m.maintenance_type_id
      WHERE m.maintenance_id = ?`,
      [maintenanceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Maintenance record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Fetch maintenance record error:", error);

    return NextResponse.json(
      { error: "Failed to fetch maintenance record." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  let connection;

  try {
    const { id } = await params;
    const maintenanceId = Number(id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      return NextResponse.json(
        { error: "Invalid maintenance ID." },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    if (typeof data.maintenance_status !== "string") {
      return NextResponse.json(
        { error: "A maintenance status is required." },
        { status: 400 }
      );
    }

    const newStatus = data.maintenance_status.toUpperCase();

    const allowedStatuses = [
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "ON_HOLD",
    ];

    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid maintenance status." },
        { status: 400 }
      );
    }

    if (
      data.technician_name != null &&
      typeof data.technician_name !== "string"
    ) {
      return NextResponse.json(
        { error: "Technician name must be a string." },
        { status: 400 }
      );
    }

    if (data.remarks != null && typeof data.remarks !== "string") {
      return NextResponse.json(
        { error: "Remarks must be a string." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [maintenanceRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        maintenance_id,
        aircraft_id,
        maintenance_status
      FROM MAINTENANCE
      WHERE maintenance_id = ?
      FOR UPDATE`,
      [maintenanceId]
    );

    if (maintenanceRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance record not found." },
        { status: 404 }
      );
    }

    const maintenance = maintenanceRows[0];
    const currentStatus = String(maintenance.maintenance_status);
    const aircraftId = Number(maintenance.aircraft_id);

    if (currentStatus === newStatus) {
      await connection.rollback();

      return NextResponse.json(
        { error: `Maintenance is already ${newStatus}.` },
        { status: 409 }
      );
    }

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      await connection.rollback();

      return NextResponse.json(
        {
          error: `Cannot change maintenance status from ${currentStatus} to ${newStatus}.`,
        },
        { status: 409 }
      );
    }

    // Lock the aircraft while updating its maintenance lifecycle.
    const [aircraftRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        a.aircraft_id,
        a.aircraft_status,
        a.total_flight_hours,
        am.maintenance_interval_hours
      FROM AIRCRAFT a
      JOIN AIRCRAFT_MODEL am
        ON am.model_id = a.model_id
      WHERE a.aircraft_id = ?
      FOR UPDATE`,
      [aircraftId]
    );

    if (aircraftRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Associated aircraft not found." },
        { status: 404 }
      );
    }

    const aircraft = aircraftRows[0];

    if (newStatus === "IN_PROGRESS") {
      const [otherRows] = await connection.execute<RowDataPacket[]>(
        `SELECT maintenance_id
         FROM MAINTENANCE
         WHERE aircraft_id = ?
           AND maintenance_id <> ?
           AND maintenance_status = 'IN_PROGRESS'
         LIMIT 1`,
        [aircraftId, maintenanceId]
      );

      if (otherRows.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            error:
              "Another maintenance task is already in progress for this aircraft.",
          },
          { status: 409 }
        );
      }

      await connection.execute(
        `UPDATE MAINTENANCE
         SET maintenance_status = 'IN_PROGRESS',
             actual_start = COALESCE(actual_start, NOW()),
             technician_name = COALESCE(?, technician_name),
             remarks = COALESCE(?, remarks)
         WHERE maintenance_id = ?`,
        [
          typeof data.technician_name === "string"
            ? data.technician_name.trim() || null
            : null,
          typeof data.remarks === "string" ? data.remarks : null,
          maintenanceId,
        ]
      );

      // Do not overwrite GROUNDED or RETIRED status.
      if (aircraft.aircraft_status === "ACTIVE") {
        await connection.execute(
          `UPDATE AIRCRAFT
           SET aircraft_status = 'MAINTENANCE'
           WHERE aircraft_id = ?`,
          [aircraftId]
        );
      }
    } else if (newStatus === "COMPLETED") {
      await connection.execute(
        `UPDATE MAINTENANCE
         SET maintenance_status = 'COMPLETED',
             actual_end = NOW(),
             technician_name = COALESCE(?, technician_name),
             remarks = COALESCE(?, remarks)
         WHERE maintenance_id = ?`,
        [
          typeof data.technician_name === "string"
            ? data.technician_name.trim() || null
            : null,
          typeof data.remarks === "string" ? data.remarks : null,
          maintenanceId,
        ]
      );

      await connection.execute(
        `UPDATE AIRCRAFT
         SET last_maintenance_date = CURRENT_DATE(),
             next_maintenance_due_hours =
               total_flight_hours + ?
         WHERE aircraft_id = ?`,
        [
          aircraft.maintenance_interval_hours,
          aircraftId,
        ]
      );

      const [otherRows] = await connection.execute<RowDataPacket[]>(
        `SELECT maintenance_id
         FROM MAINTENANCE
         WHERE aircraft_id = ?
           AND maintenance_id <> ?
           AND maintenance_status = 'IN_PROGRESS'
         LIMIT 1`,
        [aircraftId, maintenanceId]
      );

      // Only restore ACTIVE if the aircraft was marked MAINTENANCE.
      // GROUNDED and RETIRED aircraft retain their existing status.
      if (
        otherRows.length === 0 &&
        aircraft.aircraft_status === "MAINTENANCE"
      ) {
        await connection.execute(
          `UPDATE AIRCRAFT
           SET aircraft_status = 'ACTIVE'
           WHERE aircraft_id = ?`,
          [aircraftId]
        );
      }
    } else {
      await connection.execute(
        `UPDATE MAINTENANCE
         SET maintenance_status = ?,
             technician_name = COALESCE(?, technician_name),
             remarks = COALESCE(?, remarks)
         WHERE maintenance_id = ?`,
        [
          newStatus,
          typeof data.technician_name === "string"
            ? data.technician_name.trim() || null
            : null,
          typeof data.remarks === "string" ? data.remarks : null,
          maintenanceId,
        ]
      );
    }

    await connection.commit();

    const [updatedRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        maintenance_id,
        aircraft_id,
        maintenance_status,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        flight_hours_at_service,
        priority,
        technician_name,
        cost,
        remarks
      FROM MAINTENANCE
      WHERE maintenance_id = ?`,
      [maintenanceId]
    );

    return NextResponse.json({
      message: "Maintenance record updated successfully.",
      maintenance: updatedRows[0],
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Update maintenance record error:", error);

    return NextResponse.json(
      { error: "Failed to update maintenance record." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
