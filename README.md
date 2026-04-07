# ReserveProof
### The Trust Layer for Web3

> **Prove solvency. Reveal nothing.**

Privacy-preserving financial proof infrastructure built on Midnight Network.  
Any Web3 project can prove what matters — solvency, audits, team lockups, runway —  
without revealing a single number.

[![Midnight Network](https://img.shields.io/badge/Built%20on-Midnight%20Network-6C63FF?style=flat)](https://midnight.network)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/NotAditya01/Reserveproof/blob/main/LICENSE)
[![Network: Preprod](https://img.shields.io/badge/Network-Preprod-blue?style=flat)](https://midnight.network)

---

## The Problem

In November 2022, FTX collapsed and wiped out $8 billion of user funds.  
The reason? Nobody could verify if exchanges actually held what they claimed.

Today every Web3 project faces the same impossible choice:
- **Publish everything** → expose sensitive data to competitors and attackers
- **Say "trust us"** → community walks away

There is no middle ground. Until now.

---

## The Solution

ReserveProof uses Midnight Network's zero-knowledge selective disclosure to generate  
cryptographic proof of financial trustworthiness — proving exactly what verifiers  
need to know, and nothing more.

> This project directly addresses Midnight Network's own  
> [Request for Startups](https://midnight.network/request-for-start-ups?tag=finance):  
> *"DeFi protocol publishes solvency proof using ZK without revealing full balance sheet."*

---

## Live Demo

🌐 **Frontend:** [reserveproof-omega.vercel.app](https://reserveproof-omega.vercel.app/)  

## Contract Address

**Midnight Preprod Contract Address:**  
`52f640a4de5e4bc7879add4bb56aa806445e36ed20e3325e128e6b2dffef305a`

---

## Key Features

### 6 Project Categories
Context-aware proof templates for every Web3 use case:

| Category | Trust Signals Proven |
|---|---|
| 🏦 Crypto Exchange | Reserves, fund segregation, runway |
| ⚡ DeFi Protocol | TVL backing, collateral, liquidity, audit |
| 🚀 NFT Launch | Treasury, team lockup, audit, royalties |
| ✈️ Airdrop Project | Solvency, vesting, token supply |
| 🏛️ DAO | Treasury, runway, multi-sig, contributor pay |
| 📊 Lending Platform | Reserves, collateral, bad debt, audit |

### Selective Disclosure
Share different proof levels with different audiences:

| View | What Verifier Sees |
|---|---|
| **Public** | Overall VERIFIED / UNVERIFIED status only |
| **Auditor** | Attribute-level pass/fail breakdown |
| **Regulator** | Full compliance view with ratio bands + contract details |

Raw financial figures are **mathematically excluded** by the ZK circuit —  
not filtered by the API. Even at regulator level, exact numbers never appear.

### Audit Trail
Every proof is part of a public, verifiable history.  
Verifiers can see that trust is consistent over time — not just a one-time claim.

---

## Architecture
```
contracts/   Compact smart contract + compiled ZK proving assets
backend/     Express.js API + Midnight SDK integration + PostgreSQL
frontend/    React + Vite + TypeScript UI
```

### ZK Proof Flow
```
User submits financial data (stays local)
         ↓
Backend computes private witness values
         ↓
proveReserveStatus() circuit executes
         ↓
Proof server generates ZK proof (~25-30s)
         ↓
Backend wallet signs + submits to Midnight Network
         ↓
Real TX hash returned → stored in PostgreSQL
         ↓
Verifier sees only: ✅ VERIFIED — zero raw data
```

---

## Tech Stack

- **Blockchain:** Midnight Network (Preprod)
- **Smart Contract:** Compact language 
- **ZK Proof Generation:** Midnight Proof Server 7.0.0
- **Backend:** Express.js + TypeScript + PostgreSQL
- **Frontend:** React + Vite + TypeScript
- **Hosting:** Railway (backend + proof server) + Vercel (frontend)

---

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Docker (for Midnight proof server)
- Midnight Compact compiler (`compact`)

---

## Local Setup

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment
Create `/.env` at project root:
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
INDEXER_URL=https://indexer.preprod.midnight.network/api/v4/graphql
INDEXER_WS_URL=wss://indexer.preprod.midnight.network/api/v4/graphql/ws
NODE_URL=https://rpc.preprod.midnight.network
PROVE_SERVER_URL=http://127.0.0.1:6300
```

### 3. Start proof server
```bash
# Keep running in a separate terminal
npm run start-proof-server
```

### 4. Compile contract
```bash
# Requires Midnight Compact compiler
# Must be done in GitHub Codespaces or machine with AVX2 CPU
npm run compile
```

### 5. Deploy contract
```bash
cd backend && npm run deploy
```
This writes `BACKEND_WALLET_SEED` and `CONTRACT_ADDRESS` to `.env`.  
Fund the wallet from [Midnight Preprod Faucet](https://faucet.preprod.midnight.network/).

### 6. Start development server
```bash
npm run dev
```

### 7. Set frontend API URL
Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reserve/attest` | Generate ZK proof attestation |
| POST | `/api/reserve/verify` | Verify proof by hash (supports `?view=public\|auditor\|regulator`) |
| GET | `/api/reserve/history/:walletAddress` | Wallet attestation history |
| GET | `/api/reserve/history/protocol/:name` | Protocol audit trail |
| GET | `/api/reserve/feed` | Public live proof feed |

---

## Production Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Set `VITE_API_BASE_URL` env var |
| Backend | Railway | Node.js, root dir: `/`, build: `cd backend && npm install && npm run build` |
| Proof Server | Railway | Docker image: `midnightntwrk/proof-server:7.0.0` |
| Database | Supabase | Free PostgreSQL, set `DATABASE_URL` env var |

---

## Database

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for schema and setup instructions.

---

## Built For

**Rise In × Midnight Network Hackathon 2026**  
Finance & DeFi Track

---

## License

MIT — See [LICENSE](./LICENSE) for details.
