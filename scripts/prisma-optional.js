#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Run `prisma generate` only when a datasource is configured or when
// PRISMA_FORCE=1 is set. This prevents Vercel builds from failing when
// DATABASE_URL is not available during build/time in preview environments.

const force = process.env.PRISMA_FORCE === '1' || process.env.FORCE_PRISMA === '1';
const hasDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_OVERRIDE || process.env.DATABASE_URL_PREVIEW);

if (!hasDb && !force) {
  console.log('Skipping `prisma generate` because no DATABASE_URL found and PRISMA_FORCE not set.');
  process.exit(0);
}

console.log('Running `prisma generate`...');
const res = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit' });
process.exit(res.status);
