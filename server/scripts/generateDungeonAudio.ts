/**
 * generateDungeonAudio.ts
 *
 * Batch pre-generation script for all dungeon audio assets.
 * Calls the running local server to generate any uncached sounds.
 *
 * Usage:
 *   1. Start the server first:  cd server && npm run dev
 *   2. Run this script:         npx tsx scripts/generateDungeonAudio.ts
 *
 * The script will skip sounds that are already cached on disk and
 * respect ElevenLabs rate limits with a 1.2 s delay between calls.
 */

import axios, { AxiosError } from 'axios';

const API_URL = process.env.SERVER_URL ?? 'http://localhost:8787/api/audio';
const RATE_LIMIT_DELAY_MS = 1_200;

interface CategoryInfo {
  name: string;
  type: string;
  cached: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  console.log(`\n🎵 Mistral Raid — Dungeon Audio Generator`);
  console.log(`   Server: ${API_URL}\n`);

  // Fetch the full sound library from the server
  let categories: CategoryInfo[];
  try {
    const { data } = await axios.get<{ categories: CategoryInfo[] }>(`${API_URL}/categories`);
    categories = data.categories;
  } catch (err) {
    const msg = err instanceof AxiosError ? err.message : String(err);
    console.error(`❌  Could not reach server at ${API_URL}: ${msg}`);
    console.error(`    Make sure the server is running: cd server && npm run dev`);
    process.exit(1);
  }

  const pending = categories.filter((c) => !c.cached);
  const already = categories.length - pending.length;

  console.log(`📦  Total sounds : ${categories.length}`);
  console.log(`✅  Already cached: ${already}`);
  console.log(`⏳  To generate  : ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('All sounds are already generated. Nothing to do!');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pending.length; i += 1) {
    const cat = pending[i];
    const label = `[${i + 1}/${pending.length}] ${cat.name} (${cat.type})`;
    process.stdout.write(`  → ${label} ... `);

    try {
      const { data } = await axios.post<{ url: string }>(`${API_URL}/generate`, {
        category: cat.name,
      });
      console.log(`✓  ${data.url}`);
      successCount += 1;
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.error ?? err.message
          : String(err);
      console.log(`✗  FAILED: ${msg}`);
      failCount += 1;
    }

    // Rate-limit: wait between calls to respect ElevenLabs quotas
    if (i < pending.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅  Generated : ${successCount}`);
  if (failCount > 0) {
    console.log(`❌  Failed    : ${failCount}`);
  }
  console.log(`Done!\n`);
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
