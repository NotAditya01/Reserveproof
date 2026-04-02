# ReserveProof Database Setup (PostgreSQL)

This document covers the minimum database setup required to run the backend.

## 1. Create Database and Role

Open `psql` as a superuser and run:

```sql
CREATE DATABASE reserveproof_db;
CREATE ROLE reserveproof_user WITH LOGIN PASSWORD 'replace_with_strong_password';
GRANT ALL PRIVILEGES ON DATABASE reserveproof_db TO reserveproof_user;
```

## 2. Configure Backend Environment

Set the following values in the project root `/.env`:

```env
DB_NAME=reserveproof_db
DB_USER=reserveproof_user
DB_PASSWORD=replace_with_strong_password
DB_HOST=localhost
```

## 3. Table Initialization

No manual migration step is required for local development.  
On backend startup, `DatabaseService.initDb()` creates/updates required tables:

- `UserAccount`
- `reserve_attestations`

It also applies additive columns used by attestation verification:

- `category_type`
- `attributes_selected`
- `attributes_results`
- `overall_verified`
- `tx_hash`
- `on_chain`

## 4. Optional Manual Verification

To confirm setup:

```sql
\c reserveproof_db
\dt
SELECT COUNT(*) FROM reserve_attestations;
```

If these commands succeed, database connectivity and schema initialization are working.
