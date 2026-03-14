import { createApp } from './server';
import { config } from './config';
import { db } from './database';

// Ensure DB schema is initialised on startup
db();

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`\nCTSCAN running → http://localhost:${PORT}`);
  console.log(`DB: ${config.dbPath}`);
  if (!config.rettiwtApiKey) {
    console.warn('\n⚠  RETTIWT_API_KEY is not set — scans will fail until you add it.\n');
  }
});
