#!/usr/bin/env python3
"""
CTSCAN — Crypto Twitter Account Scanner
========================================

Usage
-----
    python main.py scan              # Run a full scan (all queries)
    python main.py scan --pages 10   # More pages per query (deeper scan)
    python main.py stats             # Show DB statistics
    python main.py export            # Export usernames to usernames.txt
    python main.py export --out my_list.txt

Requirements
------------
    pip install -r requirements.txt
    cp .env.example .env
    # Fill in TWITTER_BEARER_TOKEN (minimum) in .env
"""

import argparse
import logging
import sys

from rich.console import Console
from rich.table import Table
from rich.logging import RichHandler
from rich import print as rprint

import config
import database as db
import scraper

console = Console()


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True)],
    )


def cmd_scan(args: argparse.Namespace) -> None:
    if not config.BEARER_TOKEN:
        console.print(
            "[bold red]Error:[/] TWITTER_BEARER_TOKEN is not set.\n"
            "  1. Copy [cyan].env.example[/] → [cyan].env[/]\n"
            "  2. Add your Bearer Token from "
            "[link=https://developer.twitter.com/en/portal/dashboard]"
            "developer.twitter.com[/link]"
        )
        sys.exit(1)

    db.init_db()
    console.rule("[bold cyan]CTSCAN — Starting Full Crypto Twitter Scan")
    console.print(
        f"  Queries   : [yellow]{len(config.CRYPTO_QUERIES)}[/]\n"
        f"  Pages/q   : [yellow]{args.pages}[/]\n"
        f"  Hit criteria:\n"
        f"    Followers  >= [green]{config.MIN_FOLLOWERS:,}[/]\n"
        f"    Impressions >= [green]{config.MIN_IMPRESSIONS:,}[/]\n"
        f"  Database  : [cyan]{config.DB_PATH}[/]"
    )
    console.rule()

    scraper.run_full_scan(max_pages_per_query=args.pages)

    console.rule("[bold green]Scan complete")
    _print_stats()


def cmd_stats(_args: argparse.Namespace) -> None:
    db.init_db()
    _print_stats()


def cmd_export(args: argparse.Namespace) -> None:
    db.init_db()
    out = args.out
    count = db.export_usernames(out)
    console.print(
        f"[green]Exported[/] [bold]{count:,}[/] usernames → [cyan]{out}[/]"
    )


def _print_stats() -> None:
    stats = db.get_stats()

    summary = Table(title="CTSCAN Database Summary", show_header=False)
    summary.add_column("Metric", style="cyan")
    summary.add_column("Value", style="bold yellow", justify="right")
    summary.add_row("Total unique accounts", f"{stats['total_accounts']:,}")
    summary.add_row("  Hit by followers (>=3k)", f"{stats['follower_hits']:,}")
    summary.add_row("  Hit by impressions (>=10k)", f"{stats['impression_hits']:,}")
    summary.add_row("Total tweets recorded", f"{stats['total_tweets']:,}")
    summary.add_row("Total queries run", f"{stats['total_queries']:,}")
    console.print(summary)

    if stats["top_accounts"]:
        top = Table(title="Top 10 Accounts by Followers")
        top.add_column("Username", style="cyan")
        top.add_column("Followers", justify="right")
        top.add_column("Max Impressions", justify="right")
        top.add_column("Hit Reason")
        for acc in stats["top_accounts"]:
            top.add_row(
                f"@{acc['username']}",
                f"{acc['followers']:,}",
                f"{acc['max_impressions']:,}",
                acc["hit_reason"],
            )
        console.print(top)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ctscan",
        description="Crypto Twitter Account Scanner — build a database of CT accounts",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # scan
    p_scan = sub.add_parser("scan", help="Run a full scrape across all crypto queries")
    p_scan.add_argument(
        "--pages", type=int, default=5,
        help="Max pages (100 tweets each) to fetch per query (default: 5)"
    )
    p_scan.add_argument("--verbose", "-v", action="store_true")
    p_scan.set_defaults(func=cmd_scan)

    # stats
    p_stats = sub.add_parser("stats", help="Show database statistics")
    p_stats.set_defaults(func=cmd_stats)

    # export
    p_export = sub.add_parser("export", help="Export all usernames to a text file")
    p_export.add_argument("--out", default="usernames.txt", help="Output file path")
    p_export.set_defaults(func=cmd_export)

    args = parser.parse_args()
    setup_logging(getattr(args, "verbose", False))
    args.func(args)


if __name__ == "__main__":
    main()
