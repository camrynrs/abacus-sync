import {
    AccountType,
    AbacusBill,
    AbacusBillLineItem,
    AbacusBillPayment,
    AbacusChartOfAccount,
    AbacusVendor,
    BillLineItemRow,
    BillRow,
    LedgerAccountRow,
    NaturalBalance,
    PaymentRow,
    VendorRow,
  } from "./types";
  

  /**
 * Converts an unknown value to a trimmed string.
 * Falls back to a default if the input is null or undefined.
 *
 * @param input - Value to convert
 * @param fallback - Default value if input is null/undefined
 * @returns Trimmed string value
 */
  function asString(input: unknown, fallback = ""): string {
    if (input === undefined || input === null) {
      return fallback;
    }
  
    return String(input).trim();
  }

 /**
 * Converts a value to a string or null.
 * Empty strings are normalized to null for database storage.
 *
 * @param input - Value to convert
 * @returns String or null if empty
 */ 
  function asNullable(input: unknown): string | null {
    const value = asString(input);
    return value === "" ? null : value;
  }
  
  /**
 * Converts various input formats into a boolean.
 * Supports boolean, string ("true", "1", "yes"), and number (non-zero = true).
 *
 * @param input - Value to convert
 * @param fallback - Default value if input cannot be parsed
 * @returns Boolean representation of the input
 */
  function asBoolean(input: unknown, fallback = false): boolean {
    if (typeof input === "boolean") {
      return input;
    }
  
    if (typeof input === "string") {
      const normalized = input.trim().toLowerCase();
  
      if (["true", "1", "yes"].includes(normalized)) {
        return true;
      }
  
      if (["false", "0", "no"].includes(normalized)) {
        return false;
      }
    }
  
    if (typeof input === "number") {
      return input !== 0;
    }
  
    return fallback;
  }
  
  /**
 * Parses a date value and returns it in ISO YYYY-MM-DD format.
 * Throws an error if the input is missing or invalid.
 *
 * @param input - Value to parse as a date
 * @returns ISO-formatted date string
 */
  function toDate(input: unknown): string {
    const value = asString(input);
  
    if (!value) {
      throw new Error("Missing required date value");
    }
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
  
    return date.toISOString().slice(0, 10);
  }
  
  /**
 * Converts a numeric input into a fixed 4-decimal string.
 * Falls back to a default value if parsing fails.
 *
 * @param input - Value to convert
 * @param fallback - Default numeric value if parsing fails
 * @returns String formatted to 4 decimal places
 */
  function toDecimal(input: unknown, fallback = 0): string {
    const asNumber = Number(input ?? fallback);
  
    if (Number.isNaN(asNumber)) {
      return Number(fallback).toFixed(4);
    }
  
    return asNumber.toFixed(4);
  }
  
  /**
 * Maps an Abacus account type into a SoftLedger account type.
 * Uses keyword matching to determine the closest category.
 *
 * @param input - Raw account type value
 * @returns Normalized account type
 */
  function normalizeAccountType(input: unknown): AccountType {
    const value = asString(input).toLowerCase();
  
    if (
      value.includes("bank") ||
      value.includes("receivable") ||
      value.includes("asset")
    ) {
      return "Asset";
    }
  
    if (value.includes("payable") || value.includes("liability")) {
      return "Liability";
    }
  
    if (value.includes("equity")) {
      return "Equity";
    }
  
    if (value.includes("revenue") || value.includes("income")) {
      return "Revenue";
    }
  
    return "Expense";
  }
  
  /**
 * Determines the natural balance (debit or credit) for an account type.
 *
 * Assets and expenses default to debit; all others default to credit.
 *
 * @param type - Normalized account type
 * @returns Natural balance for the account
 */
  function normalizeNaturalBalance(type: AccountType): NaturalBalance {
    if (type === "Asset" || type === "Expense") {
      return "debit";
    }
  
    return "credit";
  }
  
  /**
 * Maps an Abacus chart of account into the SoftLedger ledger_accounts schema.
 *
 * Normalizes the account type and derives the natural balance based on that type.
 * Ensures required fields are present and converts optional fields to null where appropriate.
 *
 * @param raw - Raw chart of account from Abacus API
 * @returns Mapped ledger account row for database insertion
 */
  export function mapLedgerAccount(
    raw: AbacusChartOfAccount,
  ): LedgerAccountRow {
    const type = normalizeAccountType(raw.accountType);
  
    return {
      external_id: asString(raw.id),
      name: asString(raw.name),
      number: asString(raw.accountNumber),
      type,
      subtype: asString(raw.accountType, "UNSPECIFIED"),
      natural_balance: normalizeNaturalBalance(type),
      description: asNullable(raw.description),
      inactive: !(raw.isActive ?? true),
    };
  }
  

  /**
 * Maps an Abacus vendor into the SoftLedger vendors schema.
 *
 * Flattens nested address and contact fields and normalizes optional values to null.
 * Includes optional reference to a default expense account via external ID.
 *
 * @param raw - Raw vendor object from Abacus API
 * @returns Mapped vendor row for database insertion
 */
  export function mapVendor(raw: AbacusVendor): VendorRow {
    const address = raw.address;
  
    return {
      external_id: asString(raw.id),
      name: asString(raw.name),
      email: asNullable(raw.email),
      ein: null,
      is_1099: asBoolean(raw.is1099, false),
      inactive: !(raw.isActive ?? true),
      expense_account_external_id: asNullable(raw.defaultExpenseAccountId),
      address_line1: asNullable(address?.line1),
      address_line2: asNullable(address?.line2),
      address_city: asNullable(address?.city),
      address_state: asNullable(address?.stateOrProvince),
      address_zip: asNullable(address?.zipOrPostalCode),
      address_country: asNullable(address?.country),
      contact_name: asNullable(raw.contactName),
      contact_phone: asNullable(raw.contactPhone),
      contact_email: asNullable(raw.email),
    };
  }
  
  /**
 * Maps an Abacus bill into the SoftLedger bills schema.
 *
 * Extracts invoice details from nested fields and converts dates into ISO format.
 * References vendor and AP account via external IDs to be resolved during sync.
 *
 * @param raw - Raw bill object from Abacus API
 * @returns Mapped bill row for database insertion
 */
  export function mapBill(raw: AbacusBill): BillRow {
    return {
      external_id: asString(raw.id),
      vendor_external_id: asString(raw.vendorId),
      ap_account_external_id: asString(raw.invoice?.payFromChartOfAccountId),
      invoice_date: toDate(raw.invoice?.invoiceDate),
      posting_date: toDate(raw.invoice?.glPostingDate),
      due_date: raw.dueDate ? toDate(raw.dueDate) : null,
      description: asNullable(raw.description),
      currency: asString(raw.billCurrency, "USD"),
      inactive: asBoolean(raw.archived, false),
    };
  }
  
  /**
 * Maps an Abacus bill line item into the SoftLedger bill_line_items shape.
 *
 * @param raw - Raw line item from an Abacus bill
 * @param parentBillId - Parent bill ID fallback when the line item does not include billId
 * @returns Mapped bill line item row
 */
  export function mapBillLineItem(
    raw: AbacusBillLineItem,
    parentBillId?: string | number,
  ): BillLineItemRow {
    const coa = raw.classifications?.chartOfAccountId;
  
    return {
      external_id: asString(raw.id),
      bill_external_id: asString(raw.billId ?? parentBillId),
      ledger_account_external_id: asString(coa),
      line_type: "expense",
      description: asNullable(raw.description),
      amount: toDecimal(raw.amount, 0),
      quantity: toDecimal(raw.quantity, 1),
      tax_amount:
        raw.taxAmount === null || raw.taxAmount === undefined
          ? null
          : toDecimal(raw.taxAmount, 0),
    };
  }
  /**
 * Maps an Abacus payment allocation into the SoftLedger payments shape.
 *
 * Abacus payments can apply to multiple bills, so the allocation's bill ID and amount
 * are passed separately from the payment-level fields.
 *
 * @param raw - Raw Abacus payment
 * @param billExternalId - External bill ID from the payment allocation
 * @param amount - Amount applied to that bill
 * @returns Mapped payment row
 */
  export function mapPayment(
    raw: AbacusBillPayment,
    billExternalId: string,
    amount: string | number,
  ): PaymentRow {
    return {
      external_id: asString(raw.id),
      type: "manual",
      payment_date: toDate(raw.paymentDate),
      amount: toDecimal(amount, 0),
      check_number: asNullable(raw.disbursement?.checkNumber),
      memo: asNullable(raw.memo),
      ledger_account_external_id: asString(raw.fundingAccount?.id),
      bill_external_id: asString(billExternalId),
    };
  }