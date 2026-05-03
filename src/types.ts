export type AccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Revenue"
  | "Expense";

export type NaturalBalance = "debit" | "credit";

export type LookupTable = "ledger_accounts" | "vendors" | "bills";

export type AbacusAccountType =
  | "BANK"
  | "ACCOUNTS_PAYABLE"
  | "ACCOUNTS_RECEIVABLE"
  | "OTHER_CURRENT_LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE"
  | "COST_OF_GOODS_SOLD";

export interface LedgerAccountRow {
  external_id: string;
  name: string;
  number: string;
  type: AccountType;
  subtype: string;
  natural_balance: NaturalBalance;
  description: string | null;
  inactive: boolean;
}

export interface VendorRow {
  external_id: string;
  name: string;
  email: string | null;
  ein: string | null;
  is_1099: boolean;
  inactive: boolean;
  expense_account_external_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface BillRow {
  external_id: string;
  vendor_external_id: string;
  ap_account_external_id: string;
  invoice_date: string;
  posting_date: string;
  due_date: string | null;
  description: string | null;
  currency: string;
  inactive: boolean;
}

export interface BillLineItemRow {
  external_id: string;
  bill_external_id: string;
  ledger_account_external_id: string;
  line_type: "expense";
  description: string | null;
  amount: string;
  quantity: string;
  tax_amount: string | null;
}

export interface PaymentRow {
  external_id: string;
  type: "manual";
  payment_date: string;
  amount: string;
  check_number: string | null;
  memo: string | null;
  ledger_account_external_id: string;
  bill_external_id: string;
}

export interface AbacusChartOfAccount {
  id: string;
  accountNumber: string;
  name: string;
  accountType: AbacusAccountType;
  description?: string | null;
  isActive?: boolean;
}

export interface AbacusVendor {
  id: string;
  name: string;
  email?: string | null;
  is1099?: boolean;
  isActive?: boolean;
  defaultExpenseAccountId?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
    zipOrPostalCode?: string | null;
    country?: string | null;
  };
  contactName?: string | null;
  contactPhone?: string | null;
}

export interface AbacusBillLineItem {
  id: string;
  billId?: string;
  description?: string | null;
  quantity?: string | number;
  amount?: string | number;
  taxAmount?: string | number | null;
  classifications?: {
    chartOfAccountId?: string | null;
  };
}

export interface AbacusBill {
  id: string;
  vendorId: string;
  invoice?: {
    invoiceDate?: string;
    glPostingDate?: string;
    payFromChartOfAccountId?: string;
  };
  dueDate?: string | null;
  description?: string | null;
  billCurrency?: string;
  archived?: boolean;
  billLineItems?: AbacusBillLineItem[];
}

export interface AbacusBillPaymentAllocation {
  id: string;
  billId: string;
  amount: string | number;
}

export interface AbacusBillPayment {
  id: string;
  paymentDate: string;
  paymentCurrency?: string;
  fundingAccount?: {
    id?: string;
  };
  disbursement?: {
    type?: "ACH" | "CHECK" | "WIRE";
    checkNumber?: string | null;
  };
  memo?: string | null;
  isActive?: boolean;
  billPayments?: AbacusBillPaymentAllocation[];
}

export interface SyncStats {
  ledgerAccountsUpserted: number;
  vendorsUpserted: number;
  billsUpserted: number;
  billLineItemsUpserted: number;
  paymentsUpserted: number;
  skipped: number;
  errors: number;
}

export interface ApiListResponse<T> {
  results?: T[];
  nextPage?: string | null;
}