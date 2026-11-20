import { DraftStoreRegistry, ReplyDraftStore } from '@leadloom/engine/src/modules/signals-ingest';

/**
 * One session-only draft store per server instance. Drafts vanish on
 * restart; nothing is persisted to any database (out of scope).
 */
const globalForDrafts = globalThis as unknown as { __leadloomDraftRegistry?: DraftStoreRegistry };
function getRegistry(): DraftStoreRegistry {
  if (!globalForDrafts.__leadloomDraftRegistry) {
    globalForDrafts.__leadloomDraftRegistry = new DraftStoreRegistry();
  }
  return globalForDrafts.__leadloomDraftRegistry;
}

/**
 * Tenant-isolated access: every draft operation goes through the
 * authenticated user's own store. There is no cross-user read path.
 */
export function getDraftStoreForUser(ownerEmail: string): ReplyDraftStore {
  return getRegistry().forUser(ownerEmail);
}
