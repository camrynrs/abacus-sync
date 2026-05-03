import {
    AbacusBill,
    AbacusBillPayment,
    AbacusChartOfAccount,
    AbacusVendor,
    ApiListResponse,
  } from "./types";
  
  interface AbacusClientConfig {
    baseUrl: string;
    apiKey: string;
  }
  
  const PAGE_SIZE = "20";
  
  type PageResult<T> = {
    results: T[];
    nextPage: string | null;
  };
  
  export class AbacusClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
  
    constructor(config: AbacusClientConfig) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, "");
      this.apiKey = config.apiKey;
    }
  
    listLedgerAccounts(): Promise<AbacusChartOfAccount[]> {
      return this.fetchAllPages<AbacusChartOfAccount>("/v1/ledger-accounts");
    }
  
    listVendors(): Promise<AbacusVendor[]> {
      return this.fetchAllPages<AbacusVendor>("/v1/vendors");
    }
  
    listBills(): Promise<AbacusBill[]> {
      return this.fetchAllPages<AbacusBill>("/v1/bills");
    }
  
    listPayments(): Promise<AbacusBillPayment[]> {
      return this.fetchAllPages<AbacusBillPayment>("/v1/bill-payments");
    }
  
    private async fetchAllPages<T>(path: string): Promise<T[]> {
      const allResults: T[] = [];
      let nextPage: string | null = null;
  
      do {
        const page: PageResult<T> = await this.fetchPage<T>(path, nextPage);
  
        allResults.push(...page.results);
        nextPage = page.nextPage;
      } while (nextPage);
  
      return allResults;
    }
  
    private async fetchPage<T>(
      path: string,
      page: string | null,
    ): Promise<PageResult<T>> {
      const url = new URL(`${this.baseUrl}${path}`);
      url.searchParams.set("max", PAGE_SIZE);
  
      if (page) {
        url.searchParams.set("page", page);
      }
  
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });
  
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
      
        throw new Error(
          `[${payload?.error_code ?? response.status}] ${payload?.error_message ?? "Request failed"} (request_id=${payload?.request_id ?? "unknown"})`
        );
      }
  
      const payload = (await response.json()) as ApiListResponse<T>;
  
      return {
        results: payload.results ?? [],
        nextPage: payload.nextPage ?? null,
      };
    }
  }