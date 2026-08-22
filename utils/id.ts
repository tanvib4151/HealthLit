/**
 * Local id generator for on-device records. Replaced by backend-issued
 * ids if a record is ever created server-side; format stays compatible.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
