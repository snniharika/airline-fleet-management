
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/mysql";
import { AUTH_COOKIE, createAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT user_id, username, email, password_hash, role, account_status
       FROM \`USER\`
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const users = rows as {
      user_id: number;
      username: string;
      email: string;
      password_hash: string;
      role: string;
      account_status: string;
    }[];

    const user = users[0];

    if (
      !user ||
      user.account_status !== "ACTIVE" ||
      !["ADMIN", "STAFF"].includes(user.role)
    ) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    await pool.execute(
      "UPDATE `USER` SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
      [user.user_id]
    );

    const token = createAuthToken({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role as "ADMIN" | "STAFF",
    });

    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
