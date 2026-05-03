import { mapBill, mapBillLineItem } from "../mappings";
import {upsertBill,upsertBillLineItem, AppDb} from "../db";
import { SyncStats, AbacusBill } from "../types";
import { recordError, skip, getRequiredId } from "./utils";


/**
 * Syncs bills from Abacus into the DB.
 *
 * Resolves foreign keys to internal DB IDs before upserting.
 *
 * @param db - DB connection
 * @param bills - Raw bills from the Abacus API
 * @param stats - Sync statistics object for tracking results
 */
export function syncBills(db: AppDb, bills: AbacusBill[], stats: SyncStats) {
  for (const bill of bills) {
    try {
      const mapped = mapBill(bill);
      const vendorId = getRequiredId(db, "vendors", mapped.vendor_external_id);
      const apAccountId = getRequiredId(db, "ledger_accounts", mapped.ap_account_external_id);

      if (!vendorId || !apAccountId) {
        skip(stats);
        continue;
      }

      upsertBill(db, mapped, vendorId, apAccountId);
      stats.billsUpserted += 1;
    } catch (error) {
      recordError("bills", error, stats);
    }
  }
}

/**
 * Syncs bill line items from Abacus into the DB.
 *
 * Each line item must reference both its parent bill and an expense ledger account.
 *
 * @param db - DB connection
 * @param bills - Raw bills from the Abacus API, including nested line items
 * @param stats - Sync statistics object for tracking results
 */
export function syncBillLineItems(db: AppDb, bills: AbacusBill[], stats: SyncStats) {
  for (const bill of bills) {
    for (const lineItem of bill.billLineItems ?? []) {
      try {
        const mapped = mapBillLineItem(lineItem, bill.id);

        const billId = getRequiredId(db, "bills", mapped.bill_external_id);
        const ledgerAccountId = getRequiredId(db, "ledger_accounts", mapped.ledger_account_external_id);

        if (!billId || !ledgerAccountId) {
          skip(stats);
          continue;
        }

        upsertBillLineItem(db, mapped, billId, ledgerAccountId);
        stats.billLineItemsUpserted += 1;
      } catch (error) {
        recordError("bill_line_items", error, stats);
      }
    }
  }
}