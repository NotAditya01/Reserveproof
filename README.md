# ReserveProof

ReserveProof is a privacy-preserving proof-of-solvency platform built on Midnight Network.  
It allows projects to prove solvency status with zero-knowledge circuits while keeping raw financial data private.

## Core Capabilities

- Generate on-chain solvency attestations backed by Midnight ZK proofs
- Disclose only verification outcomes (tier/status), not raw reserve amounts
- Verify attestations publicly using a proof hash
- Track attestation history and feed entries via backend APIs

## Architecture

```text
contracts/   Compact contract and generated proving assets
backend/     Express API, Midnight integration, PostgreSQL persistence
frontend/    React + Vite application for attest/verify flows
```

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Docker (required for Midnight proof server)
- Midnight Compact compiler

## Quick Start

1. Install dependencies:

```bash
npm run install:all
```

2. Create root environment file `/.env`:

```env
DB_NAME=reserveproof_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
PORT=3000
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=replace-with-strong-secret
NETWORK_ID=preprod
PRIVATE_STATE_PASSWORD=replace-with-strong-password
```

3. Start proof server (keep running in a separate terminal):

```bash
npm run start-proof-server
```

4. Compile contract and deploy:

```bash
npm run compile
cd backend && npm run deploy
```

`backend/src/deploy.ts` writes `BACKEND_WALLET_SEED` and `CONTRACT_ADDRESS` to `/.env`.  
`CONTRACT_ADDRESS` is required for proof submission and on-chain verification calls.

5. Start backend and frontend:

```bash
npm run dev
```

6. Set frontend API base URL in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## ZK Proof Flow (High Level)

1. User submits attestation inputs from frontend.
2. Backend computes private witness values and calls `proveReserveStatus`.
3. Contract proves threshold satisfaction and stores public verification result.
4. Backend stores proof metadata (`proof_hash`, status, tx hash) in PostgreSQL.
5. Verifiers query by proof hash and receive only disclosed verification outputs.

## API Surface

- `POST /api/reserve/attest` Generate and store attestation proof metadata
- `POST /api/reserve/verify` Verify an attestation by `proofHash`
- `GET /api/reserve/history/:walletAddress` Fetch wallet attestation history
- `GET /api/reserve/feed` Fetch latest public attestations

## Database

Database setup is documented in [DATABASE_SETUP.md](./DATABASE_SETUP.md).

## License

MIT
