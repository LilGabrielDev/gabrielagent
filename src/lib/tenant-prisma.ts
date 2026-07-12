import { PrismaClient } from "@/generated/prisma/client";
import { AsyncLocalStorage } from "async_hooks";

const basePrisma = new PrismaClient({
  log: [],
} as any);

interface TenantContext {
  tenantId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

function withTenantScope(args: any, tenantId: string | undefined) {
  if (!tenantId) return args;
  return {
    ...args,
    where: {
      ...(args?.where || {}),
      tenantId,
    },
  };
}

export const tenantPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = withTenantScope(args, store.tenantId);
        }
        return query(args);
      },
      async findFirst({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = withTenantScope(args, store.tenantId);
        }
        return query(args);
      },
      async findUnique({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = withTenantScope(args, store.tenantId);
        }
        return query(args);
      },
      async create({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = {
            ...args,
            data: {
              ...(args?.data || {}),
              tenantId: store.tenantId,
            },
          };
        }
        return query(args);
      },
      async update({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = withTenantScope(args, store.tenantId);
        }
        return query(args);
      },
      async delete({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = withTenantScope(args, store.tenantId);
        }
        return query(args);
      },
      async upsert({ model, args, query }: any) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== "Tenant" && model !== "Settings") {
          args = {
            ...args,
            where: {
              ...((args?.where as Record<string, unknown>) || {}),
              tenantId: store.tenantId,
            },
            create: {
              ...(args?.create || {}),
              tenantId: store.tenantId,
            },
            update: {
              ...(args?.update || {}),
              tenantId: store.tenantId,
            },
          };
        }
        return query(args);
      },
    },
  },
});

export function runWithTenantContext<R>(tenantId: string | undefined, fn: () => R): R {
  return asyncLocalStorage.run({ tenantId }, fn);
}

export function getActiveTenantId(): string | undefined {
  return asyncLocalStorage.getStore()?.tenantId;
}

export const prisma: any = tenantPrisma;
