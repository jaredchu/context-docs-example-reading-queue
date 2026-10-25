// Keep deploy-specific identifiers out of the portable local-development config.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(databaseId || '') || /^0[-0]+$/.test(databaseId)) {
  throw new Error('Set CLOUDFLARE_D1_DATABASE_ID to your own D1 database UUID.');
}
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (dirty.status !== 0 || dirty.stdout.trim()) throw new Error('Deploy from a clean Git working tree so the revision identifies the live code.');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const revision = process.env.GITHUB_SHA || git.stdout?.trim();
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Deploy from a Git commit.');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
config.d1_databases[0].database_id = databaseId;
config.vars = { ...config.vars, APP_REVISION: revision };
writeFileSync('.wrangler.deploy.json', JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
const wrangler = (args) => {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args, '--config', '.wrangler.deploy.json'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
};
// Additive migrations run before code. Review compatibility before destructive changes.
wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
wrangler(['deploy']);
