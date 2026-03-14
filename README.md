# CTSCAN — Crypto Twitter Scanner

Web dashboard that builds a searchable database of Crypto Twitter accounts using **[Rettiwt-API](https://github.com/Rishikant181/Rettiwt-API)** — no official Twitter API key required.

## Features

- **Auto-categorisation** — accounts tagged by niche from tweet content:
  - 🪙 **Memecoin KOL** — posts contract addresses, pump.fun, dexscreener, #100x gems
  - ₿ **BTC Maxi** — #bitcoin, #sats, hodl, lightning, stack sats
  - 🏦 **DeFi** — yield, TVL, liquidity pools, protocols
  - 🖼 **NFT** — floor prices, mints, collections
  - 📈 **Trader / TA** — charts, signals, support/resistance, long/short
  - 🔨 **Builder** — shipping products, smart contracts, DAOs
  - 🌐 **General** — broader CT
- **Filter & search** by category, username, bio
- **Live scan log** via SSE — watch hits come in real-time
- **Export** filtered username lists as `.txt` per category
- Deploys to **Render** in one click

## Hit Criteria

| Signal | Threshold |
|--------|-----------|
| `followersCount` | ≥ 3,000 |
| `viewCount` (tweet views) | ≥ 10,000 |

## Deploy on Render

1. Push this repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. Add environment variable: `RETTIWT_API_KEY`
4. (Optional) Add a **Persistent Disk** mounted at `/data` and set `DB_PATH=/data/ctscan.db`
   so your database survives redeploys

Or use the included `render.yaml` for automatic setup.

## Local Setup

```bash
npm install
cp .env.example .env
# Fill in RETTIWT_API_KEY

npm run dev    # starts server at http://localhost:3000
```

### Get your Rettiwt API key

1. Install **X Auth Helper** on Chrome (search Chrome Web Store)
2. Open Twitter in **incognito mode** and log in
3. Click the extension → **Generate API Key**
4. Copy the base64 string → paste into `.env`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Web dashboard |
| GET | `/api/stats` | DB stats + category counts |
| GET | `/api/accounts` | Paginated list (params: `category`, `search`, `sort`, `page`) |
| POST | `/api/scan` | Start a background scan (body: `{ pages: 5 }`) |
| GET | `/api/scan/status` | Current scan state |
| GET | `/api/scan/events` | SSE stream of live log output |
| GET | `/api/export?category=memecoin_kol` | Download username list as `.txt` |

## Important: Persistent Storage on Render

Render's free tier has an **ephemeral filesystem** — your SQLite DB resets on each deploy.
To keep your data, add a Persistent Disk:

1. Render dashboard → your service → **Disks**
2. Add disk: mount path `/data`, size 1 GB ($0.25/mo)
3. Set env var `DB_PATH=/data/ctscan.db`
