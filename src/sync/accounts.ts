import { mapLedgerAccount } from "../mappings";
import { upsertLedgerAccount, AppDb } from "../db";
import { SyncStats, AbacusChartOfAccount } from "../types";
import { recordError, skip } from "./utils";

/**
 * Syncs ledger accounts from Abacus into the DB.
 *
 * For each account:
 * - Transform it into the target schema
 * - Validate required fields
 * - Upsert into the DB
 *
 * Invalid records are skipped and errors are logged without interrupting the sync.
 *
 * @param db - Database connection
 * @param accounts - Raw ledger accounts from Abacus API
 * @param stats - Sync statistics object for tracking results
 */
export function syncLedgerAccounts(db: AppDb, accounts: AbacusChartOfAccount[], stats: SyncStats) {
  for (const account of accounts) {
    try {
      const mapped = mapLedgerAccount(account);
      if (!mapped.external_id || !mapped.name || !mapped.number) {
        skip(stats);
        continue;
      }

      upsertLedgerAccount(db, mapped);
      stats.ledgerAccountsUpserted += 1;
    } catch (error) {
      recordError("ledger_accounts", error, stats);
    }
  }
}