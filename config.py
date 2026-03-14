import os
from dotenv import load_dotenv

load_dotenv()

BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")
API_KEY = os.getenv("TWITTER_API_KEY", "")
API_SECRET = os.getenv("TWITTER_API_SECRET", "")
ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN", "")
ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "")

MIN_FOLLOWERS = int(os.getenv("MIN_FOLLOWERS", 3000))
MIN_IMPRESSIONS = int(os.getenv("MIN_IMPRESSIONS", 10000))
DB_PATH = os.getenv("DB_PATH", "ctscan.db")
REQUEST_DELAY = float(os.getenv("REQUEST_DELAY", 1.0))
MAX_RESULTS_PER_QUERY = int(os.getenv("MAX_RESULTS_PER_QUERY", 100))

# Crypto search queries — rotated to maximise coverage & avoid duplicates
CRYPTO_QUERIES = [
    # Broad ecosystem
    "#bitcoin OR #btc",
    "#ethereum OR #eth",
    "#crypto OR #cryptocurrency",
    "#defi OR #decentralizedfinance",
    "#web3 OR #blockchain",
    "#altcoin OR #altcoins",
    "#nft OR #nfts",
    "#solana OR #sol",
    "#binance OR #bnb",
    "#xrp OR #ripple",
    "#cardano OR #ada",
    "#avalanche OR #avax",
    "#polkadot OR #dot",
    "#chainlink OR #link",
    "#dogecoin OR #doge",
    "#shib OR #shibainu",
    "#pepe OR #memecoin",
    "#layer2 OR #l2",
    "#stablecoin OR #usdt OR #usdc",
    "#airdrop OR #cryptoairdrop",
    # Trader / analyst language
    "crypto analysis",
    "crypto signals",
    "bitcoin analysis",
    "altcoin season",
    "crypto portfolio",
    "on-chain data",
    "crypto market",
    "crypto trading",
    "defi yield",
    "crypto gem",
    # KOL / influencer language
    "not financial advice #crypto",
    "nfa dyor #crypto",
    "#cryptotwitter",
    "#CT (crypto)",
    "alpha #crypto",
    "100x gem",
    "crypto bull run",
    "bear market #crypto",
]
