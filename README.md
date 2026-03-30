# ReserveProof
### The Trust Layer for Web3

Privacy-preserving financial proof infrastructure built on Midnight Network.

> Prove solvency, audits, team lockups, runway and more with a single ZK proof.  
> Zero financial data exposed.

## What It Does

ReserveProof enables Web3 projects to generate cryptographic proof of financial trustworthiness using Midnight Network's zero-knowledge selective disclosure framework.

Six project categories. Customizable proof attributes. One shareable verification link.

## Project Categories

| Category | Trust Signals |
|---|---|
| Crypto Exchange | Reserves, fund segregation, runway |
| DeFi Protocol | Reserve ratio, liquidity depth, collateral ratio, audit |
| NFT Launch | Treasury funded, team lockup, audit, royalties |
| Airdrop Project | Treasury solvency, vesting, supply commitment |
| DAO | Treasury solvency, runway, multi-sig, contributor pay |
| Lending Platform | Reserves, collateral ratio, bad debt, audit |

## Tech Stack

- Midnight Network (ZK proofs + selective disclosure)
- Compact smart contracts
- Express.js + PostgreSQL
- React + Vite
- TailwindCSS

## Monorepo Structure

```text
/contracts   Compact smart contracts
/backend     Express.js API + PostgreSQL
/frontend    React + Vite UI
```

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Docker Desktop ([install](https://www.docker.com/products/docker-desktop/))
- Midnight Compact compiler ([install](https://docs.midnight.network/getting-started/installation#install-compact))
- Lace wallet extension ([install](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk))

### Proof Server (Required)

The proof server generates ZK proofs locally via Docker. Start it in a separate terminal **before** deploying or running the app:

```bash
npm run start-proof-server
```

This runs `docker run -p 6300:6300 midnightntwrk/proof-server:7.0.0 -- midnight-proof-server -v` and must stay running.

### Deploy Contract

Before first run, deploy the Compact contract to Midnight Preprod:

```bash
npm run compile
cd backend && npm run deploy
```

The deploy script will:
1. Generate a `BACKEND_WALLET_SEED` (saved to `.env`)
2. Print a wallet address — fund it with NIGHT tokens from https://faucet.preprod.midnight.network/
3. Wait for DUST generation, then deploy the contract
4. Save `CONTRACT_ADDRESS` to `.env`

### Install

```bash
npm run install:all
```

### Configure

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Fill required values in `.env` (database + backend settings) and `frontend/.env` (frontend API base URL, optional contract settings).

### Compile Contract

```bash
npm run compile
```

### Run (Backend + Frontend)

```bash
npm run dev
```

## Demo Flow

1. Connect wallet on `/attest`.
2. Select project category.
3. Toggle trust attributes to include in proof.
4. Generate attestation.
5. App redirects to `/attest/:proofHash` (success + share page).
6. Share `/verify` link or raw proof hash.
7. Verifier checks proof without seeing private financial numbers.

## How Privacy Works

1. User inputs are processed as private witness-style data for proof generation flow.
2. Only proof outputs, status bands/checkmarks, and proof metadata are stored.
3. Verification shows whether required claims passed, not raw amounts.
4. Raw financial figures are mathematically excluded from verifier output.

## API Overview

### POST `/api/reserve/attest`

Accepts attestation payload with:

- wallet + protocol metadata
- optional `categoryType`
- selected `attributes[]` with inputs and enabled flags
- fallback reserve/liability fields for legacy flow

Returns proof metadata including `proofHash`.

### POST `/api/reserve/verify`

Accepts `proofHash` and returns:

- protocol + verification metadata
- category info (`categoryType`)
- attribute-level results (`attributesResults`)
- overall proof validity (`verified` / `overallVerified`)

### GET `/api/reserve/history/:walletAddress`

Returns wallet-specific attestation history.

### GET `/api/reserve/feed`

Returns recent public feed entries for homepage/dashboard.

## Frontend Routes

- `/` Home
- `/attest` Attestation flow
- `/attest/:proofHash` Proof success + share
- `/verify` Public verification page
- `/dashboard` Wallet attestation dashboard

## Built For

Rise In × Midnight Network Hackathon  
Finance & DeFi Track  
2026

## License

MIT
# Reserveproof
