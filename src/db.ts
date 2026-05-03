import Database from "better-sqlite3";
import {
  BillLineItemRow,
  BillRow,
  LedgerAccountRow,
  PaymentRow,
  VendorRow,
  LookupTable,
} from "./types";

export type AppDb = Database.Database;

export interface DbContext {
  db: AppDb;
}

const ID_LOOKUP_TABLES = new Set(["ledger_accounts", "vendors", "bills"]);

/**
 * Converts JS values into SQLite compatible parameters.
 *
 * SQLite stores booleans as 1/0 and uses null for missing values.
 *
 * @param value - Raw value to bind to a SQL statement
 * @returns SQLite compatible value
 */
function sqlParam(value: unknown): string | number | Buffer | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  return String(value);
}

/**
 * Opens the SQLite DB, enables foreign keys, and runs migrations.
 *
 * @param databasePath - Path to the SQLite DB file
 * @returns DB context containing the open DB connection
 */
export function createDb(databasePath: string): DbContext {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  migrate(db);

  return { db };
}

/**
 * Creates the target SoftLedger tables if they don't already exist.
 *
 * @param db - Open SQLite DB connection
 */
function migrate(db: AppDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      number TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      subtype TEXT NOT NULL,
      natural_balance TEXT NOT NULL,
      description TEXT,
      inactive BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      ein TEXT,
      is_1099 BOOLEAN NOT NULL DEFAULT 0,
      inactive BOOLEAN NOT NULL DEFAULT 0,
      expense_account_id BIGINT REFERENCES ledger_accounts(id),
      address_line1 TEXT,
      address_line2 TEXT,
      address_city TEXT,
      address_state TEXT,
      address_zip TEXT,
      address_country TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      vendor_id BIGINT NOT NULL REFERENCES vendors(id),
      ap_account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
      invoice_date DATE NOT NULL,
      posting_date DATE NOT NULL,
      due_date DATE,
      description TEXT,
      currency TEXT NOT NULL,
      inactive BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bill_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      ledger_account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
      line_type TEXT NOT NULL DEFAULT 'expense',
      description TEXT,
      amount NUMERIC(20,4) NOT NULL,
      quantity NUMERIC(20,4) NOT NULL,
      tax_amount NUMERIC(20,4)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payment_date DATE NOT NULL,
      amount NUMERIC(20,4) NOT NULL,
      check_number TEXT,
      memo TEXT,
      ledger_account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
      bill_id BIGINT NOT NULL REFERENCES bills(id),
      UNIQUE (external_id, bill_id)
    );
  `);
}

/**
 * Inserts or updates a ledger account by external_id.
 *
 * @param db - Open SQLite DB connection
 * @param row - Ledger account row mapped from Abacus data
 */
export function upsertLedgerAccount(db: AppDb, row: LedgerAccountRow): void {
  db.prepare(`
    INSERT INTO ledger_accounts (
      external_id,
      name,
      "number",
      "type",
      subtype,
      natural_balance,
      description,
      inactive
    ) VALUES (
      @external_id,
      @name,
      @account_number,
      @account_kind,
      @subtype,
      @natural_balance,
      @description,
      @inactive
    )
    ON CONFLICT(external_id) DO UPDATE SET
      name = excluded.name,
      "number" = excluded."number",
      "type" = excluded."type",
      subtype = excluded.subtype,
      natural_balance = excluded.natural_balance,
      description = excluded.description,
      inactive = excluded.inactive
  `).run({
    external_id: sqlParam(row.external_id),
    name: sqlParam(row.name),
    account_number: sqlParam(row.number),
    account_kind: sqlParam(row.type),
    subtype: sqlParam(row.subtype),
    natural_balance: sqlParam(row.natural_balance),
    description: sqlParam(row.description),
    inactive: sqlParam(row.inactive),
  });
}

/**
 * Inserts or updates a vendor by external_id.
 *
 * @param db - Open SQLite database connection
 * @param row - Vendor row mapped from Abacus data
 * @param expenseAccountId - Internal ledger account ID for the vendor's default expense account, if available
 */
export function upsertVendor(
  db: AppDb,
  row: VendorRow,
  expenseAccountId: number | null,
): void {
  db.prepare(`
    INSERT INTO vendors (
      external_id, name, email, ein, is_1099, inactive, expense_account_id,
      address_line1, address_line2, address_city, address_state, address_zip, address_country,
      contact_name, contact_phone, contact_email
    ) VALUES (
      @external_id, @name, @email, @ein, @is_1099, @inactive, @expense_account_id,
      @address_line1, @address_line2, @address_city, @address_state, @address_zip, @address_country,
      @contact_name, @contact_phone, @contact_email
    )
    ON CONFLICT(external_id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      ein = excluded.ein,
      is_1099 = excluded.is_1099,
      inactive = excluded.inactive,
      expense_account_id = excluded.expense_account_id,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      address_city = excluded.address_city,
      address_state = excluded.address_state,
      address_zip = excluded.address_zip,
      address_country = excluded.address_country,
      contact_name = excluded.contact_name,
      contact_phone = excluded.contact_phone,
      contact_email = excluded.contact_email
  `).run({
    external_id: sqlParam(row.external_id),
    name: sqlParam(row.name),
    email: sqlParam(row.email),
    ein: sqlParam(row.ein),
    is_1099: sqlParam(row.is_1099),
    inactive: sqlParam(row.inactive),
    expense_account_id: sqlParam(expenseAccountId),
    address_line1: sqlParam(row.address_line1),
    address_line2: sqlParam(row.address_line2),
    address_city: sqlParam(row.address_city),
    address_state: sqlParam(row.address_state),
    address_zip: sqlParam(row.address_zip),
    address_country: sqlParam(row.address_country),
    contact_name: sqlParam(row.contact_name),
    contact_phone: sqlParam(row.contact_phone),
    contact_email: sqlParam(row.contact_email),
  });
}

/**
 * Inserts or updates a bill by external_id.
 *
 * @param db - Open SQLite DB connection
 * @param row - Bill row mapped from Abacus data
 * @param vendorId - Internal vendor ID referenced by the bill
 * @param apAccountId - Internal AP ledger account ID referenced by the bill
 */
export function upsertBill(
  db: AppDb,
  row: BillRow,
  vendorId: number,
  apAccountId: number,
): void {
  db.prepare(`
    INSERT INTO bills (
      external_id, vendor_id, ap_account_id, invoice_date, posting_date, due_date, description, currency, inactive
    ) VALUES (
      @external_id, @vendor_id, @ap_account_id, @invoice_date, @posting_date, @due_date, @description, @currency, @inactive
    )
    ON CONFLICT(external_id) DO UPDATE SET
      vendor_id = excluded.vendor_id,
      ap_account_id = excluded.ap_account_id,
      invoice_date = excluded.invoice_date,
      posting_date = excluded.posting_date,
      due_date = excluded.due_date,
      description = excluded.description,
      currency = excluded.currency,
      inactive = excluded.inactive
  `).run({
    external_id: sqlParam(row.external_id),
    vendor_id: sqlParam(vendorId),
    ap_account_id: sqlParam(apAccountId),
    invoice_date: sqlParam(row.invoice_date),
    posting_date: sqlParam(row.posting_date),
    due_date: sqlParam(row.due_date),
    description: sqlParam(row.description),
    currency: sqlParam(row.currency),
    inactive: sqlParam(row.inactive),
  });
}

/**
 * Inserts or updates a bill line item by external_id.
 *
 * @param db - Open SQLite DB connection
 * @param row - Bill line item row mapped from Abacus data
 * @param billId - Internal bill ID referenced by the line item
 * @param ledgerAccountId - Internal ledger account ID referenced by the line item
 */
export function upsertBillLineItem(
  db: AppDb,
  row: BillLineItemRow,
  billId: number,
  ledgerAccountId: number,
): void {
  db.prepare(`
    INSERT INTO bill_line_items (
      external_id, bill_id, ledger_account_id, line_type, description, amount, quantity, tax_amount
    ) VALUES (
      @external_id, @bill_id, @ledger_account_id, @line_type, @description, @amount, @quantity, @tax_amount
    )
    ON CONFLICT(external_id) DO UPDATE SET
      bill_id = excluded.bill_id,
      ledger_account_id = excluded.ledger_account_id,
      line_type = excluded.line_type,
      description = excluded.description,
      amount = excluded.amount,
      quantity = excluded.quantity,
      tax_amount = excluded.tax_amount
  `).run({
    external_id: sqlParam(row.external_id),
    bill_id: sqlParam(billId),
    ledger_account_id: sqlParam(ledgerAccountId),
    line_type: sqlParam(row.line_type),
    description: sqlParam(row.description),
    amount: sqlParam(row.amount),
    quantity: sqlParam(row.quantity),
    tax_amount: sqlParam(row.tax_amount),
  });
}

/**
 * Inserts or updates a payment allocation by external_id and bill_id.
 *
 * Payments are unique per source payment and bill because one Abacus payment
 * can be allocated across multiple bills.
 *
 * @param db - Open SQLite DB connection
 * @param row - Payment row mapped from Abacus data
 * @param ledgerAccountId - Internal ledger account ID for the payment funding account
 * @param billId - Internal bill ID this payment allocation applies to
 */
export function upsertPayment(
  db: AppDb,
  row: PaymentRow,
  ledgerAccountId: number,
  billId: number,
): void {
  db.prepare(`
    INSERT INTO payments (
      external_id, "type", payment_date, amount, check_number, memo, ledger_account_id, bill_id
    ) VALUES (
      @external_id,
      @payment_kind,
      @payment_date,
      @amount,
      @check_number,
      @memo,
      @ledger_account_id,
      @bill_id
    )
    ON CONFLICT(external_id, bill_id) DO UPDATE SET
      "type" = excluded."type",
      payment_date = excluded.payment_date,
      amount = excluded.amount,
      check_number = excluded.check_number,
      memo = excluded.memo,
      ledger_account_id = excluded.ledger_account_id
  `).run({
    external_id: sqlParam(row.external_id),
    payment_kind: sqlParam(row.type),
    payment_date: sqlParam(row.payment_date),
    amount: sqlParam(row.amount),
    check_number: sqlParam(row.check_number),
    memo: sqlParam(row.memo),
    ledger_account_id: sqlParam(ledgerAccountId),
    bill_id: sqlParam(billId),
  });
}

/**
 * Looks up an internal database ID using a source-system external ID.
 *
 * Resolves foreign key relationships before inserting
 *
 * Only allows lookup on supported tables via the LookupTable type,
 * providing compile-time safety against invalid table names.
 *
 * @param db - Open SQLite DB connection
 * @param table - Target table to query
 * @param externalId - External identifier from Abacus
 * @returns Internal DB ID if found, otherwise null
 * @throws Error if an unsupported table name is provided
 */
export function getIdByExternalId(
  db: AppDb,
  table: LookupTable,
  externalId: string,
): number | null {

  const row = db
    .prepare(`SELECT id FROM ${table} WHERE external_id = ?`)
    .get(externalId) as { id: number } | undefined;

  return row?.id ?? null;
}