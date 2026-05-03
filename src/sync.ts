import { AbacusClient } from "./abacusClient";
import { createDb } from "./db";
import { SyncStats } from "./types";
import { syncLedgerAccounts } from "./sync/accounts";
import { syncVendors } from "./sync/vendors";
import { syncBills, syncBillLineItems } from "./sync/bills";
import { syncPayments } from "./sync/payments";

export interface SyncConfig {
  abacusBaseUrl: string;
  abacusApiKey: string;
  databasePath: string;
}

/**
 * Initialize counters used to track sync progress and outcomes.
 *
 * @returns SyncStats object with all counters set to 0
 */
function createStats(): SyncStats {
  return {
    ledgerAccountsUpserted: 0,
    vendorsUpserted: 0,
    billsUpserted: 0,
    billLineItemsUpserted: 0,
    paymentsUpserted: 0,
    skipped: 0,
    errors: 0,
  };
}


/**
 * Runs the full sync process.
 *
 * This function:
 * - Initializes API client and database connection
 * - Fetches all data from Abacus
 * - Executes sync steps in dependency order inside a transaction
 * - Returns statistics about the sync run
 *
 * @param config - Sync configuration including API and database settings
 * @returns SyncStats summarizing the sync results
 */
export async function runSync(config: SyncConfig): Promise<SyncStats> {
  const stats = createStats();

  const client = new AbacusClient({
    baseUrl: config.abacusBaseUrl,
    apiKey: config.abacusApiKey,
  });

  const { db } = createDb(config.databasePath);

  try {
    const accounts = await client.listLedgerAccounts();
    const vendors = await client.listVendors();
    const bills = await client.listBills();
    const payments = await client.listPayments();
    

    const transaction = db.transaction(() => {
      syncLedgerAccounts(db, accounts, stats);
      syncVendors(db, vendors, stats);
      syncBills(db, bills, stats);
      syncBillLineItems(db, bills, stats);
      syncPayments(db, payments, stats);
    });

    transaction();
    return stats;
  } finally {
    db.close();
  }
}