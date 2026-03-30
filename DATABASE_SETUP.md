## ReserveProof Database Setup Guide (PostgreSQL)

This guide covers installing PostgreSQL, setting up the database and user, and creating the `.env` file for this project.

### 1. Install PostgreSQL

First, install PostgreSQL on your computer. The process varies by operating system:
- **macOS**: Use Homebrew
- **Windows**: Use the official installer
- **Linux**: Use apt or your package manager

Download from: https://www.postgresql.org/download/

### 2. Set Up the Database and User
Open your terminal and log into psql as the default superuser, postgres.

```bash
sudo -u postgres psql
```

You should see the `postgres=#` prompt.

#### Create the Database

```sql
CREATE DATABASE reserveproof_db;
```

#### Set the User Password

```sql
ALTER USER your_username WITH PASSWORD 'yourpassword';
```

#### Grant Privileges

```sql
GRANT ALL PRIVILEGES ON DATABASE reserveproof_db TO your_username;
```

#### Exit psql

```bash
\q
```

### 3. Create the `.env` File

In your project's root folder, create a `.env` file with your database values:

```bash
DB_NAME = reserveproof_db
DB_USER = your_db_username
DB_PASSWORD = your_db_password
DB_HOST = localhost
```

#### Add `.env` to `.gitignore`

Always prevent committing secrets to version control:

```bash
node_modules/
.env
```

## Required Table for ReserveProof

```sql
CREATE TABLE IF NOT EXISTS reserve_attestations (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) NOT NULL,
    protocol_name VARCHAR(255) NOT NULL,
    total_reserves NUMERIC NOT NULL,
    total_liabilities NUMERIC NOT NULL,
    reserve_ratio NUMERIC NOT NULL,
    solvency_status VARCHAR(16) NOT NULL,
    proof_hash VARCHAR(255),
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);
```
