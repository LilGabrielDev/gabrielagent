import { PrismaClient } from "@/generated/prisma/client";
import { AsyncLocalStorage } from "async_hooks";

const prisma = new PrismaClient();

interface TenantContext {
  tenantId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

export const tenantPrisma = prisma.$extends({
  query: {
    $allModels: {
      async findMany({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async findFirst({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async findUnique({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async create({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.data = {
            ...args.data,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async update({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async delete({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
        }
        return query(args);
      },
      async upsert({
        model, args, query
      }) {
        const store = asyncLocalStorage.getStore();
        if (store?.tenantId && model !== 'Tenant' && model !== 'Settings') {
          args.where = {
            ...args.where,
            tenantId: store.tenantId,
          };
          args.create = {
            ...args.create,
            tenantId: store.tenantId,
          };
          args.update = {
            ...args.update,
            tenantId: store.tenantId,
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
