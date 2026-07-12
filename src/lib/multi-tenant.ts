/**
 * Multi-Tenant / White-Label System
 *
 * Supports:
 * 1. Single-tenant mode (default) — no tenants table, standard branding
 * 2. Multi-tenant mode — domain-based tenant resolution
 * 3. White-label mode — custom branding per tenant (logo, name, colors)
 *
 * In single-tenant mode, all functions return sensible defaults.
 * In multi-tenant mode, tenants are resolved from the database or env vars.
 */

import type { Settings } from "@/generated/prisma/client";

export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  logo: string;
  primaryColor: string;
  customDomain: string;
  isActive: boolean;
  config: Record<string, unknown>;
  settings?: Settings;
}

export interface TenantBranding {
  name: string;
  logo: string;
  primaryColor: string;
  favicon?: string;
}

/**
 * Get tenant configuration for a given hostname/domain.
 * In single-tenant mode, returns default config based on env vars.
 * In multi-tenant mode, looks up from database.
 */
export async function getTenantByDomain(
  hostname: string
): Promise<TenantConfig | null> {
  // Check env-based multi-tenant config first
  const envTenantsRaw = process.env.TENANTS;
  if (envTenantsRaw) {
    try {
      const tenants: TenantConfig[] = JSON.parse(envTenantsRaw);
      const tenant = tenants.find(
        (t) =>
          hostname === t.domain ||
          hostname === t.customDomain ||
          hostname.endsWith("." + t.domain)
      );
      if (tenant) return tenant;
    } catch {
      // Invalid JSON in env var, ignore
    }
  }

  // Try database lookup (if prisma is available)
  try {
    const { prisma } = await import("@/lib/prisma");
    const tenant = await prisma.tenant.findFirst({
      where: {
        isActive: true,
        OR: [{ domain: hostname }, { customDomain: hostname }],
      },
      include: { settings: true },
    });
    if (tenant) {
      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain || hostname,
        logo: tenant.logo || "",
        primaryColor: tenant.primaryColor || "#0F172A",
        customDomain: tenant.customDomain || "",
        isActive: tenant.isActive,
        config: (tenant.config as Record<string, unknown>) || {},
        settings: tenant.settings || undefined,
      };
    }
  } catch {
    // Database not available or Tenant table doesn't exist
  }

  return null;
}

/**
 * Get current tenant config from the request hostname.
 * Falls back to default branding from env vars.
 */
export async function getTenantConfig(
  hostname?: string
): Promise<TenantConfig | null> {
  if (hostname) {
    const tenant = await getTenantByDomain(hostname);
    if (tenant) return tenant;
  }

  // Single-tenant fallback
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Gabriel";
  const appLogo = process.env.NEXT_PUBLIC_APP_LOGO || "/gabriel.png";
  const appColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#0F172A";

  return {
    id: "default",
    name: appName,
    domain: hostname || "localhost",
    logo: appLogo,
    primaryColor: appColor,
    customDomain: "",
    isActive: true,
    config: {},
    settings: undefined,
  };
}

/**
 * Check if white-label mode is active.
 */
export function isWhiteLabel(): boolean {
  return (
    process.env.WHITE_LABEL === "true" ||
    process.env.NEXT_PUBLIC_WHITE_LABEL === "true"
  );
}

/**
 * Get branding configuration for the current tenant.
 */
export async function getTenantBranding(
  hostname?: string
): Promise<TenantBranding> {
  const config = await getTenantConfig(hostname);

  if (isWhiteLabel() && config) {
    return {
      name: config.name,
      logo: config.logo,
      primaryColor: config.primaryColor,
      favicon: config.config?.favicon as string | undefined,
    };
  }

  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || "Gabriel",
    logo: process.env.NEXT_PUBLIC_APP_LOGO || "/gabriel.png",
    primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#0F172A",
    favicon: "/gabriel.png",
  };
}
