import { AppDb, getIdByExternalId } from "../db";
import { LookupTable, SyncStats } from "../types";

export const SYNC_LOG_ERRORS = Math.max(
  0,
  Number(process.env.SYNC_LOG_ERRORS ?? "3"),
);

/**
 * Records an error that occurred during a sync phase.
 *
 * Increments the error count and logs the error message
 *
 * @param phase - The sync phase where the error occurred
 * @param error - The error object or message
 * @param stats - Sync statistics object
 */
export function recordError(phase: string, error: unknown, stats: SyncStats) {
  stats.errors += 1;

  if (SYNC_LOG_ERRORS > 0 && stats.errors <= SYNC_LOG_ERRORS) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[sync:${phase}] ${msg}`);
  }
}

/**
 * Increments the skipped record count.
 *
 * Used when a record is intentionally ignored due to
 * missing required fields or dependencies.
 *
 * @param stats - Sync statistics object
 */
export function skip(stats: SyncStats) {
  stats.skipped += 1;
}

/**
 * Resolves an external ID to an internal DB ID.
 *
 * Returns null if the external ID is missing or not found.
 *
 * @param db - DB connection
 * @param table - Table name to query
 * @param externalId - External identifier from Abacus
 * @returns Internal DB ID or null
 */
export function getRequiredId(
    db: AppDb,
    table: LookupTable,
    externalId: string,
  ): number | null {
    if (!externalId) return null;
    return getIdByExternalId(db, table, externalId);
  }