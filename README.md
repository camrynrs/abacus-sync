# Abacus → SoftLedger Sync

## How to Run

### 1. Install dependencies

npm install

### 2. Configure environment variables

Create a `.env` file:

ABACUS_API_KEY=your_base64_encoded_email  
DATABASE_PATH=./data/softledger.sqlite  
ABACUS_BASE_URL=https://abacus-mock-production.up.railway.app  
SYNC_LOG_ERRORS=3  

To generate the API key:

echo -n "your_email@example.com" | base64

### 3. Build and run

npm run build  
npm run sync

### Database

The project writes to a SQLite database using `better-sqlite3`.

- File location is controlled by DATABASE_PATH  
- Defaults to: ./data/softledger.sqlite  
- Tables are created automatically on startup  

---

## Assumptions

- Abacus external IDs are unique and stable  
- Missing required fields (e.g. external_id, name) result in skipped records  
- Payments can be split across multiple bills → stored as separate rows  
- Currency defaults to USD if missing  
- Input data may be inconsistent, so normalization is required  
- Sync is full refresh

---

## Edge Cases & Decisions

- Missing foreign keys (e.g. bill references a missing vendor)  
  Record is skipped to maintain referential integrity and avoid inserting invalid relationships.

- Invalid or missing dates  
  Mapping throws an error to prevent corrupt or misleading data from being stored. 

- Partial failures  
  Errors are handled on a per-record basis so a single bad record does not stop the entire sync from occurring. 

- Error logging  
  Logging is capped via SYNC_LOG_ERRORS to keep logs useful without overwhelming output.  

- Payments with multiple allocations  
  Expanded into multiple rows so each payment maps cleanly to a single bill in the relational schema.

- Upserts  
  Used to ensure idempotency, allowing the sync to be safely re-run without creating duplicates  

---

## What I would change or add given more time

- Cache foreign key lookups to reduce DB calls  
- Add unit tests  
- Support incremental sync instead of full sync  
- Improve logging/metrics  
- Pre-prepare SQL statements for performance  
- Add stricter validation layer  
