import { seed, type Store } from './memory.js';
import { createPrismaStoreRuntime } from './prisma.js';

export type StoreBackend = 'memory' | 'prisma';

export interface StoreRuntime {
  backend: StoreBackend;
  orgId: string;
  store: Store;
  flush: () => Promise<void>;
}

function createMemoryRuntime(): StoreRuntime {
  const store = seed();
  return {
    backend: 'memory',
    orgId: store.org.id,
    store,
    flush: async () => {},
  };
}

export async function createStoreRuntime(): Promise<StoreRuntime> {
  const preferPrisma = (process.env.REMIT_STORE_BACKEND ?? '').toLowerCase() === 'prisma' || !!process.env.DATABASE_URL;
  if (!preferPrisma) return createMemoryRuntime();

  const prismaRuntime = await createPrismaStoreRuntime();
  if (prismaRuntime) return prismaRuntime;

  return createMemoryRuntime();
}
