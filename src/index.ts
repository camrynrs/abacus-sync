import "dotenv/config";
import path from "node:path";
import { runSync } from "./sync";
import { mkdirSync } from "node:fs";

const DEFAULT_ABACUS_BASE_URL = "https://abacus-mock-production.up.railway.app";

/**
 * Entry point for the CLI.
 *
 * Loads environment configuration, ensures environment variables exist,
 * and runs the Abacus → SoftLedger sync process.
 *
 * @returns Promise<void>
 */
async function main(): Promise<void> {
  const abacusBaseUrl = process.env.ABACUS_BASE_URL ?? DEFAULT_ABACUS_BASE_URL;
  if (!process.env.ABACUS_BASE_URL) {
    console.warn(
      "[config] ABACUS_BASE_URL not set, using default mock API"
    );
  }
  const abacusApiKey = process.env.ABACUS_API_KEY;

  if (!abacusApiKey) {
    throw new Error("ABACUS_API_KEY is missing in .env file");
  }


  // Resolve the SQLite database path
  const rawDbPath = process.env.DATABASE_PATH ?? "./data/softledger.sqlite";
  const databasePath = path.isAbsolute(rawDbPath)
  ? path.normalize(rawDbPath)
  : path.resolve(process.cwd(), rawDbPath);
  const dbDir = path.dirname(databasePath);

  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    throw new Error(
        `Failed to create DB directory (${dbDir}). Set DATABASE_PATH=./data/softledger.sqlite in .env`,
        { cause: err },
    );
  }

 // Runs the sync
  const syncStats = await runSync({
    abacusBaseUrl,
    abacusApiKey,
    databasePath,
  });

  console.log("Sync complete");
  console.log(JSON.stringify(syncStats, null, 2));
}
// Top-level error handler for the CLI.
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sync failed: ${message}`);
  process.exit(1);
});
