/**
 * RBAC Middleware
 *
 * Higher-order middleware for enforcing role-based access control
 * on Next.js API routes.
 *
 * Usage:
 *   const auth = await requireRole(request, "agent");
 *   if (!isAuthenticated(auth)) return auth;
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { hasMinRole, hasPermission, ROLES, type Role, type Permission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

interface AuthContext {
  userId: string;
  role: string;
  username: string;
  name: string;
  tenantId?: string | null;
}

/**
 * Authenticate via API key (X-API-Key header).
 */
async function authenticateApiKey(apiKey: string): Promise<AuthContext | null> {
  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey, isActive: true },
  });

  if (!key) return null;

  // Fire-and-forget lastUsed update
  prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsed: new Date() },
  }).catch(() => {});

  return {
    userId: `api-key:${key.id}`,
    role: "admin",
    username: key.name,
    name: key.name,
  };
}

/**
 * Enforce minimum role level.
 * Returns AuthContext on success, NextResponse (401/403) on failure.
 */
export async function requireRole(
  request: NextRequest,
  minRole: Role
): Promise<AuthContext | NextResponse> {
  // Try API key auth
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const context = await authenticateApiKey(apiKey);
    if (!context) {
      return NextResponse.json(
        { error: { code: "INVALID_API_KEY", message: "Invalid or inactive API key" } },
        { status: 401 }
      );
    }
    if (!hasMinRole(context.role, minRole)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient role. Minimum required: " + minRole } },
        { status: 403 }
      );
    }
    return context;
  }

  // Try cookie auth
  const token = request.cookies.get("gabriel-token")?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } },
      { status: 401 }
    );
  }

  if (!hasMinRole(payload.role, minRole)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient role. Minimum required: " + minRole } },
      { status: 403 }
    );
  }

  const admin = await prisma.admin.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, name: true, role: true },
  });

  if (!admin) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  return {
    userId: admin.id,
    role: admin.role,
    username: admin.username,
    name: admin.name,
  };
}

/**
 * Enforce a specific permission.
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<AuthContext | NextResponse> {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const context = await authenticateApiKey(apiKey);
    if (!context) {
      return NextResponse.json(
        { error: { code: "INVALID_API_KEY", message: "Invalid API key" } },
        { status: 401 }
      );
    }
    if (!hasPermission(context.role, permission)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Missing permission: " + permission } },
        { status: 403 }
      );
    }
    return context;
  }

  const token = request.cookies.get("gabriel-token")?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: { code: "INVALID_TOKEN", message: "Invalid token" } },
      { status: 401 }
    );
  }

  if (!hasPermission(payload.role, permission)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: " + permission } },
      { status: 403 }
    );
  }

  const admin = await prisma.admin.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, name: true, role: true },
  });

  if (!admin) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  return {
    userId: admin.id,
    role: admin.role,
    username: admin.username,
    name: admin.name,
  };
}

export function isAuthenticated(result: AuthContext | NextResponse): result is AuthContext {
  return !(result instanceof NextResponse);
}
