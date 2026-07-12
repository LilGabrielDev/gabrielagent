import { prisma } from "@/lib/prisma";

export const DEFAULT_TENANT_ID = "default-tenant";

export async function ensureDefaultTenant() {
  return prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: "Default Tenant",
      domain: "localhost",
      logo: "/gabriel.png",
      primaryColor: "#0F172A",
      isActive: true,
    },
  });
}

export function resolveTenantId(tenantId?: string | null): string {
  return tenantId || DEFAULT_TENANT_ID;
}

export function channelLookup(type: string, tenantId: string) {
  return { type_tenantId: { type, tenantId } } as const;
}
