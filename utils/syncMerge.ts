/**
 * Generic merge helper for reconciling local and cloud copies of the
 * same record set. Last-write-wins by `updatedAt` — simple and
 * predictable, appropriate for a single-user app syncing across a
 * small number of their own devices (not true multi-user
 * collaboration, which would need real conflict resolution).
 */

export function mergeById<T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[],
): T[] {
  const merged = new Map<string, T>();

  for (const item of local) {
    merged.set(item.id, item);
  }
  for (const item of remote) {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
    }
  }

  return [...merged.values()];
}

/** For single-record entities (like the profile): newer updatedAt wins. */
export function mergeSingle<T extends { updatedAt: string }>(
  local: T | null,
  remote: T | null,
): T | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}
