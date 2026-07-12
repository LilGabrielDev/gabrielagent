import { AsyncLocalStorage } from "async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

interface TenantContext {
  tenantId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

let tenantPrismaClient: any = null;

function withTenantScope(args: Record<string, unknown> | undefined, tenantId: string | undefined) {
  if (!tenantId) return args;
  return {
    ...args,
    where: {
      ...((args?.where as Record<string, unknown> | undefined) || {}),
      tenantId,
    },
  };
}

function createTenantPrismaClient() {
  const connectionString =
    process.env["DATABASE_URL"] ||
    process.env["POSTGRES_URL"] ||
    process.env["POSTGRES_PRISMA_URL"] ||
    process.env["POSTGRES_URL_NON_POOLING"] ||
    process.env["DIRECT_URL"] ||
    "postgresql://postgres:postgres@localhost:5432/gabriel?schema=public";

  const adapter = new PrismaPg({ connectionString });

  const basePrisma = new PrismaClient({
    log: [],
    ...(adapter ? { adapter } : {}),
  } as any);

  return basePrisma.$extends({
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
}

function getTenantPrismaClient() {
  if (!tenantPrismaClient) {
    tenantPrismaClient = createTenantPrismaClient();
  }
  return tenantPrismaClient;
}

export const tenantPrisma = new Proxy({} as Record<string, unknown>, {
  get(_target, prop) {
    const client = getTenantPrismaClient();
    const value = (client as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export function runWithTenantContext<R>(tenantId: string | undefined, fn: () => R): R {
  return asyncLocalStorage.run({ tenantId }, fn);
}

export function getActiveTenantId(): string | undefined {
  return asyncLocalStorage.getStore()?.tenantId;
}

export const prisma: any = tenantPrisma;
