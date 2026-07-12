import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { runWithTenantContext } from "@/lib/tenant-prisma";
import { resolveTenantId } from "@/lib/default-tenant";

interface AuthContext {
  userId: string;
  role: string;
  username: string;
  name: string;
  tenantId?: string; // Add tenantId
  authMethod: "cookie" | "api_key";
}

/**
 * Authenticate via API key (X-API-Key header).
 */
async function authenticateApiKey(apiKey: string): Promise<AuthContext | null> {
  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { tenant: true }, // Include tenant information
  });

  if (!key || !key.isActive) return null;

  // Update lastUsed timestamp
  prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsed: new Date() },
  }).catch(() => { /* fire and forget */ });

  // API keys get admin-level access
  return {
    userId: "api-key:" + key.id,
    role: "admin",
    username: key.name,
    name: key.name,
    tenantId: key.tenantId || undefined, // Include tenantId
    authMethod: "api_key",
  };
}

/**
 * Authenticate and authorize an API request.
 * Supports both cookie (JWT) and API key (X-API-Key header) auth.
 * Returns the auth context or a 401/403 response.
 */
export async function requireAuth(
  request: NextRequest,
  permission?: Permission,
  tenantScoped: boolean = true
): Promise<AuthContext | NextResponse> {
  const requestedTenantId = request.headers.get("x-tenant-id") || request.headers.get("x-tenant");

  // Try API key auth first
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const context = await authenticateApiKey(apiKey);
    if (!context) {
      return NextResponse.json(
        { error: { code: "INVALID_API_KEY", message: "Invalid or inactive API key" } },
        { status: 401 }
      );
    }

    if (permission && !hasPermission(context.role, permission)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }

    if (tenantScoped && requestedTenantId && context.tenantId && requestedTenantId !== context.tenantId) {
      return NextResponse.json(
        { error: { code: "TENANT_MISMATCH", message: "Tenant mismatch" } },
        { status: 403 }
      );
    }

    const effectiveTenantId = resolveTenantId(context.tenantId);
    if (tenantScoped && effectiveTenantId) {
      return runWithTenantContext(effectiveTenantId, () => context);
    }
    return context;
  }

  // Fall back to cookie auth
  const token = request.cookies.get("gabriel-token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required. Use cookie or X-API-Key header." } },
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

  const admin = await prisma.admin.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, name: true, role: true, tenantId: true }, // Include tenantId
  });

  if (!admin) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      { status: 401 }
    );
  }

  if (permission && !hasPermission(payload.role, permission)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  if (tenantScoped && requestedTenantId && admin.tenantId && requestedTenantId !== admin.tenantId) {
    return NextResponse.json(
      { error: { code: "TENANT_MISMATCH", message: "Tenant mismatch" } },
      { status: 403 }
    );
  }

  const authContext: AuthContext = {
    userId: admin.id,
    role: admin.role,
    username: admin.username,
    name: admin.name,
    tenantId: admin.tenantId || undefined,
    authMethod: "cookie",
  };

  const effectiveTenantId = resolveTenantId(authContext.tenantId);
  if (tenantScoped && effectiveTenantId) {
    return runWithTenantContext(effectiveTenantId, () => authContext);
  }

  return authContext;
}

/**
 * Type guard: check if result is an auth context (not an error response).
 */
export function isAuthenticated(
  result: AuthContext | NextResponse
): result is AuthContext {
  return !(result instanceof NextResponse);
}
