/**
 * server.ts — Express web app for CTSCAN.
 *
 * Routes
 * ------
 *  GET  /                            → dashboard HTML
 *  GET  /api/stats                   → DB stats + category counts
 *  GET  /api/accounts                → paginated list (filters: category, search, sort, page)
 *  POST /api/scan                    → start a background scan
 *  GET  /api/scan/status             → current scan state
 *  GET  /api/scan/events             → SSE stream of live scan log lines
 *  GET  /api/export?category=...     → plain-text username list (download)
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import * as db from './database';
import { runFullScan, progress, subscribeLogs } from './scraper';
import { parseCategories, CATEGORY_LABELS } from './categorizer';
import { config } from './config';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── Stats ─────────────────────────────────────────────────────────────────
  app.get('/api/stats', (_req, res) => {
    try {
      res.json(db.getStats());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Accounts list ─────────────────────────────────────────────────────────
  app.get('/api/accounts', (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const search   = req.query.search   as string | undefined;
      const sort     = req.query.sort     as 'followers' | 'views' | 'first_seen' | undefined;
      const page     = parseInt(req.query.page  as string ?? '1',  10);
      const limit    = parseInt(req.query.limit as string ?? '50', 10);

      const result = db.getAccounts({ category, search, sort, page, limit: Math.min(limit, 200) });

      // Parse categories JSON for each row
      const data = result.data.map(row => ({
        ...row,
        categories: parseCategories(row.categories),
        category_labels: parseCategories(row.categories)
          .map(c => CATEGORY_LABELS[c] ?? c),
      }));

      res.json({ ...result, data });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Start scan ────────────────────────────────────────────────────────────
  app.post('/api/scan', (req: Request, res: Response) => {
    if (!config.rettiwtApiKey) {
      res.status(400).json({ error: 'RETTIWT_API_KEY is not configured on the server.' });
      return;
    }
    if (progress.running) {
      res.status(409).json({ error: 'A scan is already running.', progress });
      return;
    }

    const pages = parseInt(req.body?.pages ?? config.maxPages, 10);

    // Fire and forget — the client tracks progress via SSE
    runFullScan(pages).catch(err =>
      console.error('Scan failed:', err),
    );

    res.json({ started: true, pages, message: 'Scan started. Connect to /api/scan/events for live output.' });
  });

  // ── Scan status ───────────────────────────────────────────────────────────
  app.get('/api/scan/status', (_req, res) => {
    res.json(progress);
  });

  // ── SSE — live scan log ───────────────────────────────────────────────────
  app.get('/api/scan/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    // Send backlog of existing log lines
    for (const line of progress.log) {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    }

    // Subscribe to new lines
    const unsub = subscribeLogs(line => {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    });

    // Heartbeat to keep connection alive on Render
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20_000);

    req.on('close', () => {
      unsub();
      clearInterval(heartbeat);
    });
  });

  // ── Export usernames ──────────────────────────────────────────────────────
  app.get('/api/export', (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const content  = db.exportUsernames(category);
      const filename = category && category !== 'all'
        ? `ct_${category}_usernames.txt`
        : 'ct_all_usernames.txt';

      res.setHeader('Content-Type',        'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Category labels (for frontend) ───────────────────────────────────────
  app.get('/api/categories', (_req, res) => {
    res.json(CATEGORY_LABELS);
  });

  return app;
}
