import { seed, type Store } from './memory.js';
import { createPrismaStoreRuntime } from './prisma.js';

export type StoreBackend = 'memory' | 'prisma';

export interface StoreRuntime {
  backend: StoreBackend;
  orgId: string;
  store: Store;
  flush: () => Promise<void>;
  strictBackend: boolean;
  fallbackReason?: string;
}

function createMemoryRuntime(strictBackend: boolean, fallbackReason?: string): StoreRuntime {
  const store = seed();
  return {
    backend: 'memory',
    orgId: store.org.id,
    store,
    flush: async () => {},
    strictBackend,
    fallbackReason,
  };
}

export async function createStoreRuntime(): Promise<StoreRuntime> {
  const backendMode = (process.env.REMIT_STORE_BACKEND ?? '').trim().toLowerCase();
  const strictBackend = (process.env.REMIT_STORE_STRICT ?? '').trim().toLowerCase() === 'true';
  const preferPrisma = backendMode === 'prisma' || (backendMode !== 'memory' && !!process.env.DATABASE_URL);
  if (!preferPrisma) return createMemoryRuntime(strictBackend);

  const prismaAttempt = await createPrismaStoreRuntime();
  if (prismaAttempt.runtime) {
    return {
      ...prismaAttempt.runtime,
      strictBackend,
      fallbackReason: undefined,
    };
  }

  const fallbackReason = prismaAttempt.reason ?? 'Unknown Prisma startup error.';
  if (strictBackend) {
    throw new Error(`[Remit] Prisma backend required but unavailable: ${fallbackReason}`);
  }
  return createMemoryRuntime(strictBackend, fallbackReason);
}
