# CTSCAN — Crypto Twitter Account Scanner

Builds a SQLite database of Crypto Twitter accounts by searching the Twitter/X API v2.

## Hit Criteria

| Signal | Threshold |
|--------|-----------|
| Account followers | ≥ 3,000 |
| Tweet impressions | ≥ 10,000 |

Any account that meets **either** condition is stored.

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Twitter API credentials
Create a project + app at [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard).
The **Free tier** gives you search access (1 req / 15 min).
The **Basic tier** ($100/mo) gives 60 req / 15 min — recommended for bulk scanning.

```bash
cp .env.example .env
# Edit .env and set TWITTER_BEARER_TOKEN (minimum required)
```

### 3. Run a scan
```bash
python main.py scan              # full scan, 5 pages per query (~17k tweets)
python main.py scan --pages 10   # deeper scan (~34k tweets)
python main.py scan --verbose    # show debug output
```

### 4. View stats
```bash
python main.py stats
```

### 5. Export usernames
```bash
python main.py export                     # → usernames.txt
python main.py export --out ct_list.txt   # custom filename
```

## How it works

```
config.py          35+ crypto search queries (bitcoin, defi, web3, etc.)
    ↓
scraper.py         Twitter API v2 search_recent_tweets, paginated
    ↓  evaluates follower count + impression count per tweet
database.py        SQLite — accounts, tweets, queries tables
    ↓
main.py            CLI: scan | stats | export
```

## Database schema

**accounts** — one row per unique username
- `username`, `user_id`, `display_name`
- `followers`, `following`, `tweet_count`, `verified`
- `hit_reason` (`followers` | `impressions` | `both`)
- `max_impressions`, `first_seen`, `last_updated`

**tweets** — qualifying tweets that triggered a hit
- `tweet_id`, `username`, `text`
- `impressions`, `likes`, `retweets`, `replies`

**queries** — audit log of every API call

## Rate limits

| Tier | Requests | Tweets/month |
|------|----------|--------------|
| Free | 1 req / 15 min | 10k |
| Basic | 60 req / 15 min | 100k |

The scraper uses `wait_on_rate_limit=True` — it will sleep automatically when limits are hit.

## Configuration

All settings via `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `TWITTER_BEARER_TOKEN` | — | **Required** |
| `MIN_FOLLOWERS` | 3000 | Follower threshold |
| `MIN_IMPRESSIONS` | 10000 | Impression threshold |
| `DB_PATH` | `ctscan.db` | SQLite file |
| `MAX_RESULTS_PER_QUERY` | 100 | Tweets per API call (10–100) |
| `REQUEST_DELAY` | 1.0 | Seconds between requests |
