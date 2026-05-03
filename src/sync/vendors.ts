import { mapVendor } from "../mappings";
import { upsertVendor, AppDb } from "../db";
import { SyncStats, AbacusVendor } from "../types";
import { recordError, skip, getRequiredId } from "./utils";



/**
 * Syncs vendors from Abacus into the DB.
 *
 * Vendors can optionally reference a default expense account. External account ID is 
 * resolved to the local ledger_accounts.id before writing the vendor row.
 *
 * @param db - DB connection
 * @param vendors - Raw vendors from the Abacus API
 * @param stats - Sync statistics object for tracking results
 */
export function syncVendors(db: AppDb, vendors: AbacusVendor[], stats: SyncStats) {
  for (const vendor of vendors) {
    try {
      const mapped = mapVendor(vendor);
      if (!mapped.external_id || !mapped.name) {
        skip(stats);
        continue;
      }

    const expenseAccountId = mapped.expense_account_external_id? getRequiredId(
      db,
      "ledger_accounts",
      mapped.expense_account_external_id
    ) : null;

      upsertVendor(db, mapped, expenseAccountId);
      stats.vendorsUpserted += 1;
    } catch (error) {
      recordError("vendors", error, stats);
    }
  }
}