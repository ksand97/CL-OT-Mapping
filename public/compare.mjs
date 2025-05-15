// public/compare.mjs

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

//
// 1) __dirname shim for ESM
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//
// 2) Paths to your JSON files (both in public/)
//
const hoglundPath = resolve(__dirname, 'hoglundData1.json');
const metaPath    = resolve(__dirname, 'metaIngest_from_NT.json');

//
// 3) Load and parse Høglund data
//
const rawHoglund = JSON.parse(fs.readFileSync(hoglundPath, 'utf8'));
// If the file is an array, we take the first element; otherwise assume it's already an object
const hoglund = Array.isArray(rawHoglund) ? rawHoglund[0] : rawHoglund;

//
// 4) Load and parse Meta‐Ingest data
//
const metaArray = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
// Build a lookup map: tag → metadata
const metaMap = metaArray.reduce((acc, item) => {
  acc[item.tag] = item.metadata;
  return acc;
}, {});

//
// 5) Compute tag lists
//
const hoglundTags    = Object.keys(hoglund);
const metaTags       = Object.keys(metaMap);
const inBoth         = hoglundTags.filter(tag => metaMap.hasOwnProperty(tag));
const onlyInHoglund  = hoglundTags.filter(tag => !metaMap.hasOwnProperty(tag));
const onlyInMeta     = metaTags.filter(tag => !hoglund.hasOwnProperty(tag));

//
// 6) Enrich Høglund entries with metadata (if present)
//
const enriched = {};
hoglundTags.forEach(tag => {
  enriched[tag] = {
    ...hoglund[tag],
    metadata: metaMap[tag] || null
  };
});

//
// 7) Print a summary to the console
//
console.log('===== TAG COUNTS =====');
console.log(`Høglund total tags:      ${hoglundTags.length}`);
console.log(`Meta-Ingest total tags:  ${metaTags.length}`);
console.log(`Tags in both:            ${inBoth.length}`);
console.log(`Only in Høglund:         ${onlyInHoglund.length}`);
console.log(`Only in Meta-Ingest:     ${onlyInMeta.length}`);
console.log('\n===== SAMPLE TAGS =====');
console.log('First 5 only in Høglund:', onlyInHoglund.slice(0, 5));
console.log('First 5 only in Meta-Ingest:', onlyInMeta.slice(0, 5));

//
// 8) Write out the enriched JSON
//
const outPath = resolve(__dirname, 'hoglund_enriched.json');
fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf8');
console.log(`\nEnriched data written to ${outPath}`);
