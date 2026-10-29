
import { NextResponse } from "next/server";
import { pool } from "@/lib/mysql";

const allowedStatuses = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ON_HOLD",
];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const connection = await pool.getConnection();

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
    const { status } = body;

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid maintenance status" },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT status
       FROM MAINTENANCE
       WHERE maintenance_id = ?
       FOR UPDATE`,
      [maintenanceId]
    );

    const records = rows as { status: string }[];

    if (records.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Maintenance record not found" },
        { status: 404 }
      );
    }

    const currentStatus = records[0].status;

    const transitions: Record<string, string[]> = {
      SCHEDULED: ["IN_PROGRESS", "CANCELLED", "ON_HOLD"],
      IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
      ON_HOLD: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (
      currentStatus !== status &&
      !transitions[currentStatus]?.includes(status)
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          error: `Cannot change maintenance status from ${currentStatus} to ${status}`,
        },
        { status: 409 }
      );
    }

    if (currentStatus === status) {
      await connection.commit();

      return NextResponse.json({
        message: "Maintenance already has this status",
      });
    }

    if (status === "IN_PROGRESS") {
      await connection.execute(
        `UPDATE MAINTENANCE
         SET status = ?, actual_start = COALESCE(actual_start, NOW())
         WHERE maintenance_id = ?`,
        [status, maintenanceId]
      );
    } else if (status === "COMPLETED") {
      await connection.execute(
        `UPDATE MAINTENANCE
         SET status = ?, actual_end = NOW()
         WHERE maintenance_id = ?`,
        [status, maintenanceId]
      );
    } else {
      await connection.execute(
        `UPDATE MAINTENANCE
         SET status = ?
         WHERE maintenance_id = ?`,
        [status, maintenanceId]
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Maintenance status updated successfully",
      maintenance_id: maintenanceId,
      previous_status: currentStatus,
      status,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Update maintenance status error:", error);

    return NextResponse.json(
      { error: "Failed to update maintenance status" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
