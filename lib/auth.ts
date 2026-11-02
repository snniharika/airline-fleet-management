
import jwt, { type JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "airline_auth";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured in environment variables.");
}

export type AuthUser = {
  user_id: number;
  username: string;
  email: string;
  role: "ADMIN" | "STAFF";
};

type TokenPayload = JwtPayload & AuthUser;

export function createAuthToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET!, {
    expiresIn: "8h",
  });
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload;

    if (
      typeof decoded.user_id !== "number" ||
      !["ADMIN", "STAFF"].includes(decoded.role)
    ) {
      return null;
    }

    return {
      user_id: decoded.user_id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) return null;

  return verifyAuthToken(token);
}
