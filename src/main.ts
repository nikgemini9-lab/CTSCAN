#!/usr/bin/env ts-node
/**
 * CTSCAN — Crypto Twitter Account Scanner
 *
 * Commands:
 *   npx ts-node src/main.ts scan [--pages N]   Run full scan
 *   npx ts-node src/main.ts stats              Show DB stats
 *   npx ts-node src/main.ts export [--out FILE] Export usernames
 */

import { runFullScan } from './scraper';
import * as db from './database';
import { config } from './config';
import { QUERIES } from './config';

const args = process.argv.slice(2);
const command = args[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFlag(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

function printStats(): void {
  const s = db.getStats();

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│          CTSCAN  Database Stats          │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  Total unique accounts : ${String(s.totalAccounts).padStart(10)}       │`);
  console.log(`│    Hit by followers    : ${String(s.followerHits).padStart(10)}       │`);
  console.log(`│    Hit by views        : ${String(s.viewHits).padStart(10)}       │`);
  console.log(`│  Total tweets recorded : ${String(s.totalTweets).padStart(10)}       │`);
  console.log(`│  Total queries run     : ${String(s.totalQueries).padStart(10)}       │`);
  console.log('└─────────────────────────────────────────┘\n');

  if (s.topAccounts.length > 0) {
    console.log('Top 10 accounts by followers:');
    console.log(
      '  ' +
      'Username'.padEnd(26) +
      'Followers'.padStart(10) +
      'Max Views'.padStart(12) +
      '  Reason',
    );
    console.log('  ' + '─'.repeat(62));
    for (const acc of s.topAccounts) {
      console.log(
        '  @' +
        acc.username.padEnd(25) +
        String(acc.followers).padStart(10) +
        String(acc.max_views).padStart(12) +
        '  ' + acc.hit_reason,
      );
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdScan(): Promise<void> {
  if (!config.rettiwtApiKey) {
    console.error(
      '\nError: RETTIWT_API_KEY is not set.\n' +
      '  1. Copy .env.example → .env\n' +
      '  2. Install the "X Auth Helper" Chrome extension\n' +
      '  3. Log in to Twitter in incognito mode and generate your key\n' +
      '  4. Paste it into .env as RETTIWT_API_KEY\n',
    );
    process.exit(1);
  }

  const pages = parseInt(getFlag('--pages', String(config.maxPages)), 10);

  console.log('\n═══════════════════════════════════════════════');
  console.log('  CTSCAN — Crypto Twitter Full Scan');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queries    : ${QUERIES.length}`);
  console.log(`  Pages/q    : ${pages}  (${pages * config.pageSize} tweets max per query)`);
  console.log(`  Min followers : ${config.minFollowers.toLocaleString()}`);
  console.log(`  Min views     : ${config.minViews.toLocaleString()}`);
  console.log(`  Database   : ${config.dbPath}`);
  console.log('═══════════════════════════════════════════════\n');

  await runFullScan(pages);

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Scan complete!');
  console.log('═══════════════════════════════════════════════');
  printStats();
}

function cmdStats(): void {
  printStats();
}

function cmdExport(): void {
  const out = getFlag('--out', 'usernames.txt');
  const count = db.exportUsernames(out);
  console.log(`Exported ${count.toLocaleString()} usernames → ${out}`);
}

function printHelp(): void {
  console.log(`
CTSCAN — Crypto Twitter Account Scanner

Usage:
  npx ts-node src/main.ts scan [--pages N]     Run full scan across all queries
  npx ts-node src/main.ts stats                Show database statistics
  npx ts-node src/main.ts export [--out FILE]  Export all usernames to a file

Examples:
  npx ts-node src/main.ts scan              # 5 pages per query (~500 tweets)
  npx ts-node src/main.ts scan --pages 20   # 20 pages per query (~2000 tweets)
  npx ts-node src/main.ts stats
  npx ts-node src/main.ts export --out ct_usernames.txt
`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

(async () => {
  switch (command) {
    case 'scan':
      await cmdScan();
      break;
    case 'stats':
      cmdStats();
      break;
    case 'export':
      cmdExport();
      break;
    default:
      printHelp();
  }
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
