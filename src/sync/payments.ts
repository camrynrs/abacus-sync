import { mapPayment } from "../mappings";
import { upsertPayment, AppDb } from "../db";
import { SyncStats, AbacusBillPayment } from "../types";
import { recordError, skip, getRequiredId } from "./utils";

/**
 * Syncs payments from Abacus into the DB.
 *
 * Abacus payments may be applied to multiple bills. Each allocation is
 * expanded into a separate row so that each payment record references a
 * single bill in the DB.
 *
 * @param db - DB connection
 * @param payments - Raw payments from Abacus API
 * @param stats - Sync statistics object for tracking results
 */
export function syncPayments(db: AppDb, payments: AbacusBillPayment[], stats: SyncStats) {
  for (const payment of payments) {
    for (const allocation of payment.billPayments ?? []) {
      try {
        const mapped = mapPayment(
          payment,
          allocation.billId,
          allocation.amount
        );

        const billId = getRequiredId(db, "bills", mapped.bill_external_id);
        const ledgerAccountId = getRequiredId(db, "ledger_accounts", mapped.ledger_account_external_id);

        if (!billId || !ledgerAccountId) {
          skip(stats);
          continue;
        }

        upsertPayment(db, mapped, ledgerAccountId, billId);
        stats.paymentsUpserted += 1;
      } catch (error) {
        recordError("payments", error, stats);
      }
    }
  }
}