"""
database.py — SQLite persistence layer for CTSCAN.

Tables
------
accounts  : every unique username that qualifies as a hit
tweets    : raw tweet records that triggered a hit
queries   : audit log of every search query run
"""

import sqlite3
import threading
from datetime import datetime
from typing import Optional

import config


# Thread-local storage so each thread gets its own connection
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA synchronous=NORMAL")
    return _local.conn


def init_db() -> None:
    """Create tables if they don't already exist."""
    conn = _get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            user_id         TEXT,
            display_name    TEXT,
            followers       INTEGER DEFAULT 0,
            following       INTEGER DEFAULT 0,
            tweet_count     INTEGER DEFAULT 0,
            verified        INTEGER DEFAULT 0,
            bio             TEXT,
            hit_reason      TEXT,          -- 'followers' | 'impressions' | 'both'
            max_impressions INTEGER DEFAULT 0,
            first_seen      TEXT    NOT NULL,
            last_updated    TEXT    NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_username  ON accounts(username);
        CREATE INDEX IF NOT EXISTS idx_accounts_followers ON accounts(followers DESC);

        CREATE TABLE IF NOT EXISTS tweets (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            tweet_id        TEXT    NOT NULL UNIQUE,
            username        TEXT    NOT NULL COLLATE NOCASE,
            text            TEXT,
            impressions     INTEGER DEFAULT 0,
            likes           INTEGER DEFAULT 0,
            retweets        INTEGER DEFAULT 0,
            replies         INTEGER DEFAULT 0,
            created_at      TEXT,
            recorded_at     TEXT    NOT NULL,
            FOREIGN KEY (username) REFERENCES accounts(username)
        );

        CREATE INDEX IF NOT EXISTS idx_tweets_username    ON tweets(username);
        CREATE INDEX IF NOT EXISTS idx_tweets_impressions ON tweets(impressions DESC);

        CREATE TABLE IF NOT EXISTS queries (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            query       TEXT    NOT NULL,
            ran_at      TEXT    NOT NULL,
            tweets_fetched  INTEGER DEFAULT 0,
            hits_found      INTEGER DEFAULT 0,
            next_token  TEXT
        );
        """
    )
    conn.commit()


def upsert_account(
    *,
    username: str,
    user_id: str,
    display_name: str,
    followers: int,
    following: int,
    tweet_count: int,
    verified: bool,
    bio: str,
    hit_reason: str,
    impressions: int = 0,
) -> bool:
    """
    Insert or update an account record.
    Returns True if this is a brand-new account, False if updated.
    """
    conn = _get_conn()
    now = datetime.utcnow().isoformat()

    existing = conn.execute(
        "SELECT id, max_impressions, hit_reason FROM accounts WHERE username = ?",
        (username,),
    ).fetchone()

    if existing:
        new_impressions = max(existing["max_impressions"], impressions)
        # Merge hit reason
        old_reason = existing["hit_reason"]
        if old_reason != hit_reason and hit_reason not in old_reason:
            merged = "both"
        else:
            merged = old_reason

        conn.execute(
            """
            UPDATE accounts SET
                user_id=?, display_name=?, followers=?, following=?,
                tweet_count=?, verified=?, bio=?, hit_reason=?,
                max_impressions=?, last_updated=?
            WHERE username=?
            """,
            (
                user_id, display_name, followers, following,
                tweet_count, int(verified), bio, merged,
                new_impressions, now, username,
            ),
        )
        conn.commit()
        return False
    else:
        conn.execute(
            """
            INSERT INTO accounts
                (username, user_id, display_name, followers, following,
                 tweet_count, verified, bio, hit_reason, max_impressions,
                 first_seen, last_updated)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                username, user_id, display_name, followers, following,
                tweet_count, int(verified), bio, hit_reason, impressions,
                now, now,
            ),
        )
        conn.commit()
        return True


def upsert_tweet(
    *,
    tweet_id: str,
    username: str,
    text: str,
    impressions: int,
    likes: int,
    retweets: int,
    replies: int,
    created_at: str,
) -> None:
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    conn.execute(
        """
        INSERT INTO tweets
            (tweet_id, username, text, impressions, likes, retweets, replies,
             created_at, recorded_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(tweet_id) DO UPDATE SET
            impressions=excluded.impressions,
            likes=excluded.likes,
            retweets=excluded.retweets,
            replies=excluded.replies
        """,
        (tweet_id, username, text, impressions, likes, retweets, replies,
         created_at, now),
    )
    conn.commit()


def log_query(
    query: str,
    tweets_fetched: int,
    hits_found: int,
    next_token: Optional[str] = None,
) -> None:
    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO queries (query, ran_at, tweets_fetched, hits_found, next_token)
        VALUES (?,?,?,?,?)
        """,
        (query, datetime.utcnow().isoformat(), tweets_fetched, hits_found, next_token),
    )
    conn.commit()


def get_stats() -> dict:
    conn = _get_conn()
    total_accounts = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
    follower_hits = conn.execute(
        "SELECT COUNT(*) FROM accounts WHERE hit_reason LIKE '%followers%'"
    ).fetchone()[0]
    impression_hits = conn.execute(
        "SELECT COUNT(*) FROM accounts WHERE hit_reason LIKE '%impressions%'"
    ).fetchone()[0]
    total_tweets = conn.execute("SELECT COUNT(*) FROM tweets").fetchone()[0]
    total_queries = conn.execute("SELECT COUNT(*) FROM queries").fetchone()[0]
    top_accounts = conn.execute(
        "SELECT username, followers, max_impressions, hit_reason "
        "FROM accounts ORDER BY followers DESC LIMIT 10"
    ).fetchall()
    return {
        "total_accounts": total_accounts,
        "follower_hits": follower_hits,
        "impression_hits": impression_hits,
        "total_tweets": total_tweets,
        "total_queries": total_queries,
        "top_accounts": [dict(r) for r in top_accounts],
    }


def export_usernames(path: str = "usernames.txt") -> int:
    """Dump all discovered usernames to a plain text file, one per line."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT username FROM accounts ORDER BY followers DESC"
    ).fetchall()
    with open(path, "w") as f:
        for row in rows:
            f.write(row["username"] + "\n")
    return len(rows)
