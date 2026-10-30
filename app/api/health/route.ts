import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { getMongoDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const result = {
    mysql: "not tested",
    mongodb: "not tested",
  };

  try {
    const [rows] = await pool.query("SELECT 1 AS connection_test");
    result.mysql = "connected";
  } catch (error) {
    console.error("MySQL connection failed:", error);
    result.mysql = "connection failed";
  }

  try {
    const db = await getMongoDatabase();
    await db.command({ ping: 1 });
    result.mongodb = "connected";
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    result.mongodb = "connection failed";
  }

  const success =
    result.mysql === "connected" &&
    result.mongodb === "connected";

  return NextResponse.json(result, {
    status: success ? 200 : 500,
  });
}
