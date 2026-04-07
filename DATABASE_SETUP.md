# ReserveProof Database Setup

ReserveProof uses PostgreSQL for storing proof 
attestations and verification history.

## Option A — Local PostgreSQL

### 1. Create database and user
```sql
CREATE DATABASE reserveproof_db;
CREATE ROLE reserveproof_user 
  WITH LOGIN PASSWORD 'replace_with_strong_password';
GRANT ALL PRIVILEGES ON DATABASE reserveproof_db 
  TO reserveproof_user;
```

### 2. Configure .env
```env
DB_NAME=reserveproof_db
DB_USER=reserveproof_user
DB_PASSWORD=replace_with_strong_password
DB_HOST=localhost
DB_PORT=5432
```

### 3. Tables

No manual migration needed.
`DatabaseService.initDb()` runs on backend startup
and creates all required tables automatically:

| Table | Purpose |
|---|---|
| `UserAccount` | Wallet session tracking |
| `reserve_attestations` | ZK proof records and history |

---

## Option B — Supabase (Production/Cloud)

1. Create free project at supabase.com
2. Go to Connect → Direct connection → URI
3. Copy the connection string
4. Set in Railway environment variables:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
```

The backend automatically uses `DATABASE_URL`
when present, falling back to individual
`DB_*` variables for local development.

---

## Verify Setup
```sql
\c reserveproof_db
\dt
SELECT COUNT(*) FROM reserve_attestations;
```

All three commands succeeding confirms
database is correctly configured.

---

## Schema Overview

`reserve_attestations` columns:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `wallet_address` | VARCHAR | Prover wallet |
| `protocol_name` | VARCHAR | Project name |
| `category_type` | VARCHAR | exchange/defi/nft/airdrop/dao/lending |
| `solvency_status` | VARCHAR | SOLVENT/WARNING/INSOLVENT |
| `proof_hash` | VARCHAR | Unique proof identifier |
| `verified` | BOOLEAN | Proof validity |
| `on_chain` | BOOLEAN | Submitted to Midnight Network |
| `tx_hash` | VARCHAR | Midnight Network TX hash |
| `attributes_selected` | JSONB | Which attributes were proven |
| `attributes_results` | JSONB | Pass/fail per attribute |
| `overall_verified` | BOOLEAN | All required attributes passed |
| `created_at` | TIMESTAMP | Proof generation time |
| `expires_at` | TIMESTAMP | Proof expiry (90 days) |