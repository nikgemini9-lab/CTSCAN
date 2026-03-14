# CTSCAN — Crypto Twitter Account Scanner

Builds a growing SQLite database of Crypto Twitter accounts by searching Twitter/X using **[Rettiwt-API](https://github.com/Rishikant181/Rettiwt-API)** — no official Twitter API key required.

## Hit Criteria

| Signal | Threshold |
|--------|-----------|
| `followersCount` | ≥ 3,000 |
| `viewCount` (tweet views) | ≥ 10,000 |

Any account meeting **either** condition is stored.

## Setup

### 1. Prerequisites

- Node.js 22+
- A Twitter/X account

### 2. Install dependencies

```bash
npm install
```

### 3. Get your Rettiwt API key

1. Install the **X Auth Helper** extension:
   - Chrome: search "X Auth Helper" on the Chrome Web Store
2. Open Twitter in **incognito mode** and log in
3. Click the extension icon → **Generate API Key**
4. Copy the base64 string

```bash
cp .env.example .env
# Paste your key as RETTIWT_API_KEY in .env
```

### 4. Run

```bash
# Full scan (35 queries × 5 pages = up to 17,500 tweets checked)
npx ts-node src/main.ts scan

# Deeper scan (~35,000 tweets)
npx ts-node src/main.ts scan --pages 20

# View stats
npx ts-node src/main.ts stats

# Export usernames (one per line)
npx ts-node src/main.ts export
npx ts-node src/main.ts export --out my_ct_list.txt
```

## How it works

```
config.ts         35 search queries (bitcoin, defi, web3, solana, nft, …)
    ↓
scraper.ts        Rettiwt tweet.search() with pagination
    ↓  checks tweet.viewCount and tweet.tweetBy.followersCount
database.ts       SQLite — accounts, tweets, queries tables
    ↓
main.ts           CLI: scan | stats | export
```

## Database schema

**accounts** — one row per unique username
- `username`, `user_id`, `display_name`
- `followers`, `following`, `tweet_count`, `verified`
- `hit_reason`: `followers` | `views` | `both`
- `max_views`, `first_seen`, `last_updated`

**tweets** — qualifying tweet records
- `tweet_id`, `username`, `text`
- `views`, `likes`, `retweets`, `replies`

**queries** — audit log (label, ran_at, tweets_fetched, hits_found)

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `RETTIWT_API_KEY` | — | **Required** |
| `MIN_FOLLOWERS` | `3000` | Follower threshold |
| `MIN_VIEWS` | `10000` | View/impression threshold |
| `DB_PATH` | `ctscan.db` | SQLite file path |
| `PAGE_SIZE` | `100` | Tweets per request (max 100) |
| `MAX_PAGES` | `5` | Pages per query |
| `REQUEST_DELAY_MS` | `1500` | Delay between requests |

## Output

```
─── Query 1/35: bitcoin ────────────────────────────
  [NEW] @SatoshiSpirit           followers=  82,341  views=  234,100  reason=both
  [NEW] @CryptoAnalystPro        followers=   4,210  views=   12,500  reason=both
  [UPD] @BitcoinMagazine         followers= 891,000  views=  450,000  reason=both
  page=1/5  fetched=100  hits=34
  ── done: total fetched=500  total hits=178
```
