/**
 * database.ts — SQLite persistence layer (better-sqlite3, synchronous API).
 *
 * Tables
 * ------
 *  accounts  : one row per unique username that qualified as a hit
 *  tweets    : raw tweet records that triggered a hit
 *  queries   : audit log of every search run
 */

import Database from 'better-sqlite3';
import { config } from './config';

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (!_db) {
    _db = new Database(config.dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(conn: Database.Database): void {
  conn.exec(`
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
      hit_reason      TEXT,
      max_views       INTEGER DEFAULT 0,
      first_seen      TEXT    NOT NULL,
      last_updated    TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_username  ON accounts(username);
    CREATE INDEX IF NOT EXISTS idx_accounts_followers ON accounts(followers DESC);

    CREATE TABLE IF NOT EXISTS tweets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id    TEXT    NOT NULL UNIQUE,
      username    TEXT    NOT NULL COLLATE NOCASE,
      text        TEXT,
      views       INTEGER DEFAULT 0,
      likes       INTEGER DEFAULT 0,
      retweets    INTEGER DEFAULT 0,
      replies     INTEGER DEFAULT 0,
      created_at  TEXT,
      recorded_at TEXT    NOT NULL,
      FOREIGN KEY (username) REFERENCES accounts(username)
    );

    CREATE INDEX IF NOT EXISTS idx_tweets_username ON tweets(username);
    CREATE INDEX IF NOT EXISTS idx_tweets_views    ON tweets(views DESC);

    CREATE TABLE IF NOT EXISTS queries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      label          TEXT    NOT NULL,
      ran_at         TEXT    NOT NULL,
      tweets_fetched INTEGER DEFAULT 0,
      hits_found     INTEGER DEFAULT 0
    );
  `);
}

// ---------------------------------------------------------------------------

export interface AccountRow {
  username: string;
  userId: string;
  displayName: string;
  followers: number;
  following: number;
  tweetCount: number;
  verified: boolean;
  bio: string;
  hitReason: 'followers' | 'views' | 'both';
  views: number;
}

/**
 * Upsert an account. Returns true if brand-new, false if updated.
 */
export function upsertAccount(row: AccountRow): boolean {
  const now = new Date().toISOString();
  const conn = db();

  const existing = conn
    .prepare('SELECT id, max_views, hit_reason FROM accounts WHERE username = ?')
    .get(row.username) as { id: number; max_views: number; hit_reason: string } | undefined;

  if (existing) {
    const newMaxViews = Math.max(existing.max_views, row.views);
    const mergedReason =
      existing.hit_reason !== row.hitReason && !existing.hit_reason.includes(row.hitReason)
        ? 'both'
        : existing.hit_reason;

    conn.prepare(`
      UPDATE accounts SET
        user_id=?, display_name=?, followers=?, following=?,
        tweet_count=?, verified=?, bio=?, hit_reason=?,
        max_views=?, last_updated=?
      WHERE username=?
    `).run(
      row.userId, row.displayName, row.followers, row.following,
      row.tweetCount, row.verified ? 1 : 0, row.bio, mergedReason,
      newMaxViews, now, row.username,
    );
    return false;
  }

  conn.prepare(`
    INSERT INTO accounts
      (username, user_id, display_name, followers, following,
       tweet_count, verified, bio, hit_reason, max_views, first_seen, last_updated)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    row.username, row.userId, row.displayName, row.followers, row.following,
    row.tweetCount, row.verified ? 1 : 0, row.bio, row.hitReason, row.views,
    now, now,
  );
  return true;
}

export function upsertTweet(opts: {
  tweetId: string;
  username: string;
  text: string;
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}): void {
  const now = new Date().toISOString();
  db().prepare(`
    INSERT INTO tweets
      (tweet_id, username, text, views, likes, retweets, replies, created_at, recorded_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(tweet_id) DO UPDATE SET
      views=excluded.views, likes=excluded.likes,
      retweets=excluded.retweets, replies=excluded.replies
  `).run(
    opts.tweetId, opts.username, opts.text, opts.views,
    opts.likes, opts.retweets, opts.replies, opts.createdAt, now,
  );
}

export function logQuery(label: string, tweetsFetched: number, hitsFound: number): void {
  db().prepare(
    'INSERT INTO queries (label, ran_at, tweets_fetched, hits_found) VALUES (?,?,?,?)',
  ).run(label, new Date().toISOString(), tweetsFetched, hitsFound);
}

export function getStats() {
  const conn = db();
  return {
    totalAccounts:   (conn.prepare('SELECT COUNT(*) as n FROM accounts').get() as { n: number }).n,
    followerHits:    (conn.prepare("SELECT COUNT(*) as n FROM accounts WHERE hit_reason LIKE '%followers%'").get() as { n: number }).n,
    viewHits:        (conn.prepare("SELECT COUNT(*) as n FROM accounts WHERE hit_reason LIKE '%views%'").get() as { n: number }).n,
    totalTweets:     (conn.prepare('SELECT COUNT(*) as n FROM tweets').get() as { n: number }).n,
    totalQueries:    (conn.prepare('SELECT COUNT(*) as n FROM queries').get() as { n: number }).n,
    topAccounts:     conn.prepare(
      'SELECT username, followers, max_views, hit_reason FROM accounts ORDER BY followers DESC LIMIT 10',
    ).all() as { username: string; followers: number; max_views: number; hit_reason: string }[],
  };
}

export function exportUsernames(path: string): number {
  const rows = db()
    .prepare('SELECT username FROM accounts ORDER BY followers DESC')
    .all() as { username: string }[];
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(path, rows.map(r => r.username).join('\n') + '\n');
  return rows.length;
}
