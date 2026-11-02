
import { NextRequest, NextResponse } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";

const AUTH_COOKIE = "airline_auth";

type TokenPayload = JwtPayload & {
  user_id: number;
  role: string;
};

function isValidToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) return null;

    const decoded = jwt.verify(token, secret) as TokenPayload;

    if (
      typeof decoded.user_id !== "number" ||
      !["ADMIN", "STAFF"].includes(decoded.role)
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const user = token ? isValidToken(token) : null;

  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
