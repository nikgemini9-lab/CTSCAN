/**
 * categorizer.ts — Auto-tag accounts based on tweet content.
 *
 * Categories
 * ----------
 *  memecoin_kol  Posts contract addresses, pump.fun, dexscreener, #100x gems
 *  btc_maxi      Primarily talks Bitcoin/Sats/Lightning, rarely mentions alts
 *  defi          Yield, liquidity, TVL, protocols, on-chain finance
 *  nft           NFT mints, floor prices, collections
 *  trader        TA charts, signals, long/short calls
 *  builder       Ships products, talks smart contracts/DAOs, dev content
 *  general       Catch-all for accounts that don't fit a specific niche
 */

// Solana address: base58, 32–44 chars (excludes common English words)
const SOLANA_CA = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
// Ethereum/EVM address
const ETH_CA = /\b0x[a-fA-F0-9]{40}\b/;

export type Category =
  | 'memecoin_kol'
  | 'btc_maxi'
  | 'defi'
  | 'nft'
  | 'trader'
  | 'builder'
  | 'general';

export const CATEGORY_LABELS: Record<Category, string> = {
  memecoin_kol: 'Memecoin KOL',
  btc_maxi:     'BTC Maxi',
  defi:         'DeFi',
  nft:          'NFT',
  trader:       'Trader / TA',
  builder:      'Builder',
  general:      'General Crypto',
};

interface TweetSignals {
  text: string;
  hashtags: string[];
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return needles.some(n => haystack.includes(n));
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.filter(k => text.includes(k)).length;
}

export function detectCategories(
  signal: TweetSignals,
  existing: Category[] = [],
): Category[] {
  const text = signal.text.toLowerCase();
  const tags = signal.hashtags.map(h => h.toLowerCase());
  const cats = new Set<Category>(existing);

  // ── Memecoin KOL ─────────────────────────────────────────────────────────
  const memeHashtags = [
    'memecoin', 'memecoins', '100x', 'gem', 'pepe', 'bonk', 'wif',
    'dogwifhat', 'floki', 'babydoge', 'safemoon', 'moonshot',
  ];
  const memeKeywords = [
    'pump.fun', 'pumpfun', 'dexscreener', 'raydium', 'jupiter',
    'ca:', 'contract address', 'contract:', 'token address',
    'just launched', 'new launch', 'stealth launch', 'fair launch',
    'lp locked', 'renounced', 'buy now', 'gem alert', '100x gem',
    'degen play', 'ape in', 'low cap', 'micro cap',
  ];
  if (
    SOLANA_CA.test(signal.text) ||
    ETH_CA.test(signal.text) ||
    hasAny(tags, memeHashtags) ||
    countMatches(text, memeKeywords) >= 1
  ) {
    cats.add('memecoin_kol');
  }

  // ── Bitcoin Maxi ──────────────────────────────────────────────────────────
  const btcHashtags = [
    'bitcoin', 'btc', 'sats', 'satoshi', 'hodl',
    'stacksats', 'lightning', 'bitcoinonly', 'bitcoinmaxi',
  ];
  const btcKeywords = [
    'stack sats', 'lightning network', 'bitcoin standard',
    'proof of work', 'store of value', 'digital gold',
  ];
  if (hasAny(tags, btcHashtags) || countMatches(text, btcKeywords) >= 1) {
    cats.add('btc_maxi');
  }

  // ── DeFi ──────────────────────────────────────────────────────────────────
  const defiHashtags = ['defi', 'decentralizedfinance', 'degens', 'yield'];
  const defiKeywords = [
    'yield farming', 'liquidity pool', 'tvl', 'apy', 'apr',
    'liquidity provider', 'impermanent loss', 'dex', 'amm',
    'lending protocol', 'borrow', 'collateral', 'staking rewards',
    'uniswap', 'aave', 'compound', 'curve', 'velodrome', 'gmx',
    'perpetual', 'perp trading', 'on-chain',
  ];
  if (
    hasAny(tags, defiHashtags) ||
    countMatches(text, defiKeywords) >= 2
  ) {
    cats.add('defi');
  }

  // ── NFT ───────────────────────────────────────────────────────────────────
  const nftHashtags = ['nft', 'nfts', 'nftart', 'nftcommunity', 'nftcollector'];
  const nftKeywords = [
    'floor price', 'floor is', 'mint', 'minting', 'opensea',
    'blur', 'magic eden', 'collection', 'pfp', 'generative art',
    'royalties', 'listed for', 'sweep the floor',
  ];
  if (
    hasAny(tags, nftHashtags) ||
    countMatches(text, nftKeywords) >= 2
  ) {
    cats.add('nft');
  }

  // ── Trader / TA ───────────────────────────────────────────────────────────
  const traderHashtags = [
    'cryptotrading', 'cryptosignals', 'trading', 'ta', 'technicalanalysis',
  ];
  const traderKeywords = [
    'support level', 'resistance', 'breakout', 'breakdown', 'bullish',
    'bearish', 'long position', 'short position', 'take profit', 'stop loss',
    'rsi', 'macd', 'moving average', 'price target', 'chart',
    'trendline', 'consolidation', 'accumulation', 'distribution',
    'higher high', 'lower low', 'fibonacci', 'fib',
  ];
  if (
    hasAny(tags, traderHashtags) ||
    countMatches(text, traderKeywords) >= 2
  ) {
    cats.add('trader');
  }

  // ── Builder ───────────────────────────────────────────────────────────────
  const builderHashtags = ['buidl', 'web3', 'blockchain', 'opensource'];
  const builderKeywords = [
    'just shipped', 'just launched', 'we built', 'building on',
    'smart contract', 'solidity', 'rust', 'anchor framework',
    'dao', 'governance', 'v1', 'v2', 'testnet', 'mainnet launch',
    'open source', 'github', 'pull request', 'audit',
    'whitepaper', 'tokenomics', 'roadmap',
  ];
  if (
    hasAny(tags, builderHashtags) ||
    countMatches(text, builderKeywords) >= 2
  ) {
    cats.add('builder');
  }

  // ── General fallback ──────────────────────────────────────────────────────
  if (cats.size === 0) {
    cats.add('general');
  }

  return Array.from(cats);
}

export function serializeCategories(cats: Category[]): string {
  return JSON.stringify(cats);
}

export function parseCategories(raw: string | null): Category[] {
  if (!raw) return ['general'];
  try {
    return JSON.parse(raw) as Category[];
  } catch {
    return ['general'];
  }
}
