/**
 * scraper.ts — Rettiwt-API search with category detection.
 *
 * Hit criteria (either qualifies):
 *   tweet.tweetBy.followersCount >= MIN_FOLLOWERS
 *   tweet.viewCount              >= MIN_VIEWS
 *
 * Every qualifying tweet is also run through the categorizer so the account
 * gets tagged automatically (memecoin_kol, btc_maxi, defi, nft, trader, builder).
 */

import { Rettiwt, type ITweetFilter } from 'rettiwt-api';
import { config, QUERIES, type QuerySpec } from './config';
import * as db from './database';
import { detectCategories } from './categorizer';

// ---------------------------------------------------------------------------

export interface ScanProgress {
  running: boolean;
  currentQuery: string;
  queryIndex: number;
  totalQueries: number;
  totalTweetsSeen: number;
  totalHits: number;
  log: string[];          // last N log lines (ring buffer)
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const MAX_LOG_LINES = 200;

export const progress: ScanProgress = {
  running: false,
  currentQuery: '',
  queryIndex: 0,
  totalQueries: QUERIES.length,
  totalTweetsSeen: 0,
  totalHits: 0,
  log: [],
  startedAt: null,
  finishedAt: null,
  error: null,
};

// SSE subscriber callbacks
const subscribers = new Set<(line: string) => void>();

export function subscribeLogs(cb: (line: string) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function emit(line: string): void {
  progress.log.push(line);
  if (progress.log.length > MAX_LOG_LINES) progress.log.shift();
  subscribers.forEach(cb => cb(line));
  console.log(line);
}

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildClient(): Rettiwt {
  if (!config.rettiwtApiKey) {
    throw new Error(
      'RETTIWT_API_KEY is not set — add it to your environment variables.',
    );
  }
  return new Rettiwt({ apiKey: config.rettiwtApiKey });
}

// ---------------------------------------------------------------------------

async function scrapeQuery(
  client: Rettiwt,
  spec: QuerySpec,
  maxPages: number,
): Promise<void> {
  const filter: ITweetFilter = {
    includeWords: spec.words,
    hashtags:     spec.hashtags,
    minLikes:     spec.minLikes,
    onlyOriginal: true,
  };

  let cursor: string | undefined;
  let page = 0;
  let totalFetched = 0;
  let totalHits = 0;

  while (page < maxPages) {
    let response;
    try {
      response = await client.tweet.search(filter, config.pageSize, cursor);
    } catch (err) {
      emit(`  [ERROR] ${spec.label} page ${page + 1}: ${String(err)}`);
      break;
    }

    const tweets = response?.list ?? [];
    if (tweets.length === 0) break;

    totalFetched += tweets.length;
    progress.totalTweetsSeen += tweets.length;
    let pageHits = 0;

    for (const tweet of tweets) {
      const author    = tweet.tweetBy;
      const views     = tweet.viewCount        ?? 0;
      const followers = author.followersCount  ?? 0;

      const followerHit = followers >= config.minFollowers;
      const viewHit     = views     >= config.minViews;
      if (!followerHit && !viewHit) continue;

      const hitReason =
        followerHit && viewHit ? 'both' :
        followerHit            ? 'followers' : 'views';

      // Detect categories from this tweet
      const cats = detectCategories({
        text:     tweet.fullText ?? '',
        hashtags: tweet.entities?.hashtags ?? [],
      });

      const isNew = db.upsertAccount({
        username:    author.userName,
        userId:      author.id,
        displayName: author.fullName,
        followers,
        following:   author.followingsCount ?? 0,
        tweetCount:  author.statusesCount   ?? 0,
        verified:    author.isVerified,
        bio:         author.description     ?? '',
        hitReason,
        categories: cats,
        views,
      });

      db.upsertTweet({
        tweetId:   tweet.id,
        username:  author.userName,
        text:      tweet.fullText ?? '',
        views,
        likes:     tweet.likeCount    ?? 0,
        retweets:  tweet.retweetCount ?? 0,
        replies:   tweet.replyCount   ?? 0,
        createdAt: tweet.createdAt,
      });

      pageHits++;
      progress.totalHits++;

      const tag = isNew ? 'NEW' : 'UPD';
      emit(
        `[${tag}] @${author.userName.padEnd(24)} ` +
        `followers=${String(followers).padStart(7)}  ` +
        `views=${String(views).padStart(8)}  ` +
        `[${cats.join(', ')}]`,
      );
    }

    totalHits += pageHits;
    emit(`  page ${page + 1}/${maxPages} | fetched=${tweets.length} hits=${pageHits}`);

    cursor = response?.next?.value;
    if (!cursor) break;

    page++;
    await sleep(config.delayMs);
  }

  db.logQuery(spec.label, totalFetched, totalHits);
  emit(`  ✓ ${spec.label}: fetched=${totalFetched} hits=${totalHits}`);
}

// ---------------------------------------------------------------------------

export async function runFullScan(maxPages?: number): Promise<void> {
  if (progress.running) {
    throw new Error('A scan is already in progress.');
  }

  const client = buildClient();
  const pages  = maxPages ?? config.maxPages;

  progress.running = true;
  progress.queryIndex = 0;
  progress.totalTweetsSeen = 0;
  progress.totalHits = 0;
  progress.log = [];
  progress.startedAt = new Date().toISOString();
  progress.finishedAt = null;
  progress.error = null;

  emit(`=== CTSCAN full scan started | queries=${QUERIES.length} pages/q=${pages} ===`);

  try {
    for (let i = 0; i < QUERIES.length; i++) {
      const spec = QUERIES[i];
      progress.currentQuery = spec.label;
      progress.queryIndex   = i + 1;

      emit(`\n─── Query ${i + 1}/${QUERIES.length}: ${spec.label} ${'─'.repeat(35)}`);
      await scrapeQuery(client, spec, pages);
      await sleep(config.delayMs);
    }
    emit(`\n=== Scan complete | total seen=${progress.totalTweetsSeen} hits=${progress.totalHits} ===`);
  } catch (err) {
    progress.error = String(err);
    emit(`[FATAL] ${progress.error}`);
  } finally {
    progress.running = false;
    progress.finishedAt = new Date().toISOString();
  }
}
