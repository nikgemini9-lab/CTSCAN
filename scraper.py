"""
scraper.py — Twitter/X API v2 scraper for Crypto Twitter accounts.

Hit criteria
------------
  • Author has >= MIN_FOLLOWERS followers, OR
  • Tweet has >= MIN_IMPRESSIONS impressions (public_metrics.impression_count)

Both conditions are tracked separately; an account can qualify on either.

Rate limits (Twitter API v2 — Free / Basic tier)
-------------------------------------------------
  • Search recent tweets : 1 req / 15 min  (Free) | 60 req / 15 min (Basic)
  • The scraper honours rate-limit headers automatically via Tweepy.
"""

import time
import logging
from datetime import datetime, timezone
from typing import Optional

import tweepy

import config
import database as db

logger = logging.getLogger(__name__)


def _build_client() -> tweepy.Client:
    if not config.BEARER_TOKEN:
        raise RuntimeError(
            "TWITTER_BEARER_TOKEN is not set. "
            "Copy .env.example → .env and fill in your credentials."
        )
    return tweepy.Client(
        bearer_token=config.BEARER_TOKEN,
        consumer_key=config.API_KEY or None,
        consumer_secret=config.API_SECRET or None,
        access_token=config.ACCESS_TOKEN or None,
        access_token_secret=config.ACCESS_TOKEN_SECRET or None,
        wait_on_rate_limit=True,  # Tweepy will sleep automatically
    )


def _iso(dt) -> str:
    if dt is None:
        return ""
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def _process_response(
    response: tweepy.Response,
    query: str,
) -> tuple[int, int]:
    """
    Walk through a search response, evaluate hit criteria, persist records.
    Returns (tweets_fetched, hits_found).
    """
    if not response.data:
        return 0, 0

    # Build user lookup dict: user_id -> user object
    users: dict[str, tweepy.User] = {}
    if response.includes and "users" in response.includes:
        for u in response.includes["users"]:
            users[u.id] = u

    tweets_fetched = len(response.data)
    hits_found = 0

    for tweet in response.data:
        public_metrics = tweet.public_metrics or {}
        impressions: int = public_metrics.get("impression_count", 0)
        likes: int = public_metrics.get("like_count", 0)
        retweets: int = public_metrics.get("retweet_count", 0)
        replies: int = public_metrics.get("reply_count", 0)

        author = users.get(tweet.author_id)
        if author is None:
            continue

        author_metrics = author.public_metrics or {}
        followers: int = author_metrics.get("followers_count", 0)
        following: int = author_metrics.get("following_count", 0)
        tweet_count: int = author_metrics.get("tweet_count", 0)

        follower_hit = followers >= config.MIN_FOLLOWERS
        impression_hit = impressions >= config.MIN_IMPRESSIONS

        if not (follower_hit or impression_hit):
            continue

        # Determine reason label
        if follower_hit and impression_hit:
            reason = "both"
        elif follower_hit:
            reason = "followers"
        else:
            reason = "impressions"

        username: str = author.username
        is_new = db.upsert_account(
            username=username,
            user_id=str(author.id),
            display_name=author.name or "",
            followers=followers,
            following=following,
            tweet_count=tweet_count,
            verified=bool(getattr(author, "verified", False)),
            bio=author.description or "",
            hit_reason=reason,
            impressions=impressions,
        )

        db.upsert_tweet(
            tweet_id=str(tweet.id),
            username=username,
            text=tweet.text or "",
            impressions=impressions,
            likes=likes,
            retweets=retweets,
            replies=replies,
            created_at=_iso(tweet.created_at),
        )

        hits_found += 1
        status = "NEW" if is_new else "UPD"
        logger.info(
            "[%s] @%-25s  followers=%6d  impressions=%7d  reason=%s",
            status, username, followers, impressions, reason,
        )

    return tweets_fetched, hits_found


def scrape_query(
    client: tweepy.Client,
    query: str,
    *,
    max_pages: int = 5,
    next_token: Optional[str] = None,
) -> None:
    """
    Run a single search query, paginating up to `max_pages` times.
    Skips retweets and replies to keep signal clean.
    """
    full_query = f"({query}) -is:retweet lang:en"
    logger.info("Query: %s", full_query)

    page = 0
    while page < max_pages:
        try:
            response = client.search_recent_tweets(
                query=full_query,
                max_results=config.MAX_RESULTS_PER_QUERY,
                tweet_fields=["public_metrics", "created_at", "author_id"],
                user_fields=[
                    "public_metrics", "description", "verified", "name", "username"
                ],
                expansions=["author_id"],
                next_token=next_token,
            )
        except tweepy.TweepyException as exc:
            logger.error("API error on query '%s': %s", query, exc)
            break

        fetched, hits = _process_response(response, query)
        db.log_query(
            query=full_query,
            tweets_fetched=fetched,
            hits_found=hits,
            next_token=next_token,
        )
        logger.info(
            "  page=%d  fetched=%d  hits=%d", page + 1, fetched, hits
        )

        # Check for next page
        meta = response.meta or {}
        next_token = meta.get("next_token")
        if not next_token:
            break

        page += 1
        time.sleep(config.REQUEST_DELAY)


def run_full_scan(max_pages_per_query: int = 5) -> None:
    """
    Iterate over all CRYPTO_QUERIES and scrape each one.
    Progress is printed; rate-limit sleeps are handled by Tweepy.
    """
    client = _build_client()
    total_queries = len(config.CRYPTO_QUERIES)

    for idx, query in enumerate(config.CRYPTO_QUERIES, start=1):
        logger.info(
            "─── Query %d/%d ───────────────────────────────────",
            idx, total_queries,
        )
        scrape_query(client, query, max_pages=max_pages_per_query)
        # Small breathing room between queries
        time.sleep(config.REQUEST_DELAY)
