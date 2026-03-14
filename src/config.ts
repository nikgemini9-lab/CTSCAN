import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  rettiwtApiKey: process.env.RETTIWT_API_KEY ?? '',
  minFollowers: parseInt(process.env.MIN_FOLLOWERS ?? '3000', 10),
  minViews:     parseInt(process.env.MIN_VIEWS     ?? '10000', 10),
  dbPath:       process.env.DB_PATH                ?? 'ctscan.db',
  pageSize:     parseInt(process.env.PAGE_SIZE     ?? '100', 10),
  maxPages:     parseInt(process.env.MAX_PAGES     ?? '5', 10),
  delayMs:      parseInt(process.env.REQUEST_DELAY_MS ?? '1500', 10),
};

// ---------------------------------------------------------------------------
// Search queries — rotated across the 35 most-used CT keywords/phrases.
// Rettiwt ITweetFilter uses `includeWords` (any of these must appear).
// We split into individual query objects so each gets its own pagination.
// ---------------------------------------------------------------------------
export interface QuerySpec {
  label: string;
  words?: string[];
  hashtags?: string[];
  minLikes?: number;
}

export const QUERIES: QuerySpec[] = [
  // Core coins
  { label: 'bitcoin',        hashtags: ['bitcoin'] },
  { label: 'btc',            hashtags: ['btc'] },
  { label: 'ethereum',       hashtags: ['ethereum'] },
  { label: 'eth',            hashtags: ['eth'] },
  { label: 'solana',         hashtags: ['solana'] },
  { label: 'sol',            hashtags: ['sol'] },
  { label: 'xrp',            hashtags: ['xrp'] },
  { label: 'cardano',        hashtags: ['cardano'] },
  { label: 'bnb',            hashtags: ['bnb'] },
  { label: 'doge',           hashtags: ['dogecoin', 'doge'] },
  { label: 'avax',           hashtags: ['avalanche', 'avax'] },
  { label: 'polkadot',       hashtags: ['polkadot', 'dot'] },
  { label: 'chainlink',      hashtags: ['chainlink', 'link'] },
  { label: 'shib',           hashtags: ['shib', 'shibainu'] },
  { label: 'pepe',           hashtags: ['pepe', 'memecoin'] },
  // Ecosystem
  { label: 'crypto',         hashtags: ['crypto', 'cryptocurrency'] },
  { label: 'defi',           hashtags: ['defi', 'decentralizedfinance'] },
  { label: 'web3',           hashtags: ['web3'] },
  { label: 'blockchain',     hashtags: ['blockchain'] },
  { label: 'nft',            hashtags: ['nft', 'nfts'] },
  { label: 'altcoin',        hashtags: ['altcoin', 'altcoins'] },
  { label: 'layer2',         hashtags: ['layer2', 'l2'] },
  { label: 'stablecoin',     hashtags: ['stablecoin', 'usdt', 'usdc'] },
  { label: 'airdrop',        hashtags: ['airdrop', 'cryptoairdrop'] },
  // Trader / analyst phrases
  { label: 'cryptotrading',  words: ['crypto', 'trading'] },
  { label: 'cryptosignals',  words: ['crypto', 'signals'] },
  { label: 'btcanalysis',    words: ['bitcoin', 'analysis'] },
  { label: 'altcoinseason',  words: ['altcoin', 'season'] },
  { label: 'onchain',        words: ['on-chain', 'data'] },
  { label: 'defiYield',      words: ['defi', 'yield'] },
  { label: 'cryptogem',      words: ['crypto', 'gem'] },
  { label: '100xgem',        words: ['100x', 'gem'] },
  // KOL language (high engagement filter to reduce noise)
  { label: 'nfa_dyor',       words: ['nfa', 'dyor'], minLikes: 20 },
  { label: 'cryptotwitter',  hashtags: ['cryptotwitter'] },
  { label: 'alphatweetsct',  words: ['alpha'], hashtags: ['crypto'], minLikes: 30 },
];
