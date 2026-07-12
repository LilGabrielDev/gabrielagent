import { prisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/multi-tenant";

/**
 * Resolve tenantId from hostname.
 * Falls back to "default" if tenant cannot be resolved.
 */
export async function resolveTenantIdFromHostname(
  hostname?: string
): Promise<string> {
  const tenant = await getTenantConfig(hostname);
  return tenant?.id || "default";
}

/**
 * Fetch tenant-bound settings.
 * NOTE: This repo currently has a single global `Settings` row;
 * this helper centralizes tenant routing so you can swap to
 * tenant-scoped settings later.
 */
export async function getTenantSettings(_tenantId: string) {
  return prisma.settings.findFirst();
}

/**
 * Central helper to create tenant-scoped Prisma queries.
 * Pattern: use `tenantId` in where clauses.
 */
export function tenantWhere<T extends object>(tenantId: string, where: T): T {
  // At runtime we can't validate schema columns; just merge.
  return { ...(where as object), tenantId } as T;
}

