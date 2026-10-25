import assert from 'node:assert/strict';
assert.ok(process.env.DEMO_URL, 'Set DEMO_URL to the deployed HTTPS app URL');
const base = new URL(process.env.DEMO_URL);
assert.equal(base.protocol, 'https:');
let observed;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const response = await fetch(new URL('/api/health', base), { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (response.ok) {
      observed = await response.json();
      if (observed.ok && observed.revision === process.env.GITHUB_SHA) break;
    }
  } catch {
    // The first deployment may still be propagating DNS or the new version.
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
}
assert.equal(observed?.ok, true);
assert.equal(observed?.revision, process.env.GITHUB_SHA, 'Live app must report the deployed commit');
console.log('Live health endpoint matches the deployed commit.');
