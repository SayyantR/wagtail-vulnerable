/**
 * CLI helper to export Wagtail page content to JSON for offline analysis.
 *
 * Usage:
 *   node scripts/export-content.js --page-id 42 --depth 3 --output ./export.json
 *   node scripts/export-content.js --all --output ./export.json
 *
 * VULNERABLE (CVE-2021-44906 / minimist 1.2.5):
 *   minimist 1.2.5 allows prototype pollution through the
 *   `constructor.prototype` path, bypassing the earlier `__proto__` patch.
 *   If this script receives arguments from an untrusted source (e.g. a
 *   CI job whose parameters are user-controlled, or a JSON config file
 *   spread into argv), an attacker can inject properties onto
 *   Function.prototype that affect every function call in the process.
 *
 *   PoC: node export-content.js --_.constructor.prototype.polluted pwned
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));

const BASE_URL = argv['base-url'] ?? 'http://localhost:8000';
const PAGE_ID = argv['page-id'];
const DEPTH = argv['depth'] ?? 1;
const OUTPUT = argv['output'] ?? './export.json';
const EXPORT_ALL = argv['all'] ?? false;

function buildApiUrl() {
  if (EXPORT_ALL) {
    return `${BASE_URL}/api/v2/pages/?fields=*&limit=1000`;
  }
  if (!PAGE_ID) {
    console.error('Error: --page-id or --all is required');
    process.exit(1);
  }
  return `${BASE_URL}/api/v2/pages/${PAGE_ID}/?fields=*&depth=${DEPTH}`;
}

async function exportContent() {
  const url = buildApiUrl();
  console.log(`Fetching: ${url}`);

  const { default: fetch } = await import('node-fetch');
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`API error: HTTP ${resp.status}`);
    process.exit(1);
  }

  const data = await resp.json();
  const outPath = path.resolve(OUTPUT);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Exported to ${outPath}`);
}

exportContent().catch((err) => {
  console.error(err);
  process.exit(1);
});
