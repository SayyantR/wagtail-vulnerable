/**
 * Health-check script for configured Wagtail webhook endpoints.
 *
 * Reads webhook URLs from the admin API and pings each one to verify
 * it is reachable. Exits non-zero if any endpoint is unreachable so
 * this can be wired into CI or a cron job.
 *
 * Usage:
 *   node scripts/check-webhooks.js --base-url http://localhost:8000 \
 *       --token <service-account-api-token>
 *
 * VULNERABLE (CVE-2022-0235 / node-fetch 2.6.6):
 *   If a webhook URL responds with a 301/302 redirect to a different host,
 *   node-fetch forwards the Authorization header to the redirected host.
 *   An attacker who can register a webhook URL that redirects to their
 *   server receives the service-account token and can impersonate it.
 */

const fetch = require('node-fetch');

async function getWebhookUrls(baseUrl, token) {
  const resp = await fetch(`${baseUrl}/api/v2/webhooks/`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!resp.ok) throw new Error(`Failed to list webhooks: ${resp.status}`);
  const data = await resp.json();
  return (data.items ?? []).map((w) => w.url);
}

async function pingWebhook(url, token) {
  // Authorization forwarded on redirect — this is the vulnerable call.
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event: 'ping' }),
    // default: redirect = 'follow'
  });
  return resp.status;
}

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[args.indexOf('--base-url') + 1] ?? 'http://localhost:8000';
  const token = args[args.indexOf('--token') + 1] ?? '';

  const urls = await getWebhookUrls(baseUrl, token);
  console.log(`Checking ${urls.length} webhook(s)...`);

  let failures = 0;
  for (const url of urls) {
    try {
      const status = await pingWebhook(url, token);
      const ok = status >= 200 && status < 300;
      console.log(`${ok ? '✓' : '✗'} ${url} → HTTP ${status}`);
      if (!ok) failures++;
    } catch (err) {
      console.error(`✗ ${url} → ${err.message}`);
      failures++;
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
