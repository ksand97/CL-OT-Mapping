// scripts/fetchTags.mjs
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fetch from 'node-fetch'; // if you don't have node-fetch, run: npm install node-fetch

// __dirname shim for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const IMO = 9278234;
const PAGE_SIZE = 1000;     // bump this up if your server allows bigger pages
const BASE_URL = 'https://topichandler.int.uhsplatform.com/SensorEdge/GetTags';

async function main() {
  let page = 1;
  let allTags = [];

  while (true) {
    const url = `${BASE_URL}?imo=${IMO}&sortDesc=false&page=${page}&pageSize=${PAGE_SIZE}&addCounter=false`;
    console.log(`Fetching page ${page}…`);
    const res = await fetch(url, { headers: { accept: '*/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
    const json = await res.json();

    if (!Array.isArray(json) || json.length === 0) {
      console.log('No more results, stopping.');
      break;
    }

    allTags = allTags.concat(json);
    if (json.length < PAGE_SIZE) {
      // last partial page
      console.log('Last page received.');
      break;
    }
    page++;
  }

  // Write out combined file
  const outPath = resolve(__dirname, '../public/fullTags.json');
  fs.writeFileSync(outPath, JSON.stringify(allTags, null, 2), 'utf8');
  console.log(`✅ Wrote ${allTags.length} tags to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
