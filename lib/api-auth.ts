
import { NextResponse } from "next/server";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

type AuthorizationResult =
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse };

export async function requireApiRole(
  allowedRoles?: readonly AuthUser["role"][]
): Promise<AuthorizationResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "You do not have permission to perform this operation." },
        { status: 403 }
      ),
    };
  }

  return { user, error: null };
}
