/**
 * scraper.ts — Crypto Twitter scanner using Rettiwt-API.
 *
 * Hit criteria (either qualifies an account):
 *   • tweet.tweetBy.followersCount >= MIN_FOLLOWERS
 *   • tweet.viewCount              >= MIN_VIEWS
 *
 * Rettiwt uses guest or user authentication (no official Twitter API key needed).
 * Get your API key via the "X Auth Helper" browser extension — see README.
 */

import { Rettiwt, type ITweetFilter } from 'rettiwt-api';
import { config, QUERIES, type QuerySpec } from './config';
import * as db from './database';

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildClient(): Rettiwt {
  if (!config.rettiwtApiKey) {
    throw new Error(
      'RETTIWT_API_KEY is not set.\n' +
      '  1. Copy .env.example → .env\n' +
      '  2. Install the "X Auth Helper" Chrome extension\n' +
      '  3. Log in to Twitter in incognito, generate your key\n' +
      '  4. Paste it as RETTIWT_API_KEY in .env',
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
    onlyOriginal: true,   // skip retweets
  };

  let cursor: string | undefined = undefined;
  let page = 0;
  let totalFetched = 0;
  let totalHits = 0;

  while (page < maxPages) {
    let response;
    try {
      response = await client.tweet.search(filter, config.pageSize, cursor);
    } catch (err) {
      console.error(`  [ERROR] query="${spec.label}" page=${page + 1}:`, err);
      break;
    }

    const tweets = response?.list ?? [];
    if (tweets.length === 0) break;

    totalFetched += tweets.length;
    let pageHits = 0;

    for (const tweet of tweets) {
      const author   = tweet.tweetBy;
      const views    = tweet.viewCount    ?? 0;
      const followers = author.followersCount ?? 0;

      const followerHit = followers >= config.minFollowers;
      const viewHit     = views     >= config.minViews;

      if (!followerHit && !viewHit) continue;

      const hitReason =
        followerHit && viewHit ? 'both' :
        followerHit            ? 'followers' : 'views';

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
        views,
      });

      db.upsertTweet({
        tweetId:   tweet.id,
        username:  author.userName,
        text:      tweet.fullText,
        views,
        likes:     tweet.likeCount    ?? 0,
        retweets:  tweet.retweetCount ?? 0,
        replies:   tweet.replyCount   ?? 0,
        createdAt: tweet.createdAt,
      });

      pageHits++;
      console.log(
        `  [${isNew ? 'NEW' : 'UPD'}] @${author.userName.padEnd(24)} ` +
        `followers=${String(followers).padStart(7)}  ` +
        `views=${String(views).padStart(8)}  ` +
        `reason=${hitReason}`,
      );
    }

    totalHits += pageHits;
    console.log(
      `  page=${page + 1}/${maxPages}  fetched=${tweets.length}  hits=${pageHits}`,
    );

    // Move to next page
    cursor = response?.next?.value;
    if (!cursor) break;

    page++;
    await sleep(config.delayMs);
  }

  db.logQuery(spec.label, totalFetched, totalHits);
  console.log(
    `  ── done: total fetched=${totalFetched}  total hits=${totalHits}`,
  );
}

// ---------------------------------------------------------------------------

export async function runFullScan(maxPages?: number): Promise<void> {
  const client   = buildClient();
  const pages    = maxPages ?? config.maxPages;
  const total    = QUERIES.length;

  for (let i = 0; i < total; i++) {
    const spec = QUERIES[i];
    console.log(`\n─── Query ${i + 1}/${total}: ${spec.label} ${'─'.repeat(40)}`);
    await scrapeQuery(client, spec, pages);
    await sleep(config.delayMs);
  }
}
