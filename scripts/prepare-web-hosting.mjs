import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist-web');
const target = resolve(root, 'firebase/hosting');

const assetPathPattern = /\/assets\/[^"'\s)]+/g;
const hashedAssetPattern = /^\/assets\/(.+\/)(.+)\.([a-f0-9]{32})\.([a-z0-9]+)$/i;

function collectJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function collectReferencedAssets(exportDir) {
  const assetPaths = new Set();

  for (const jsFile of collectJsFiles(exportDir)) {
    const content = readFileSync(jsFile, 'utf8');
    for (const match of content.matchAll(assetPathPattern)) {
      assetPaths.add(match[0]);
    }
  }

  return assetPaths;
}

function syncHashedAssets(assetPaths) {
  let copied = 0;
  let missing = 0;

  for (const assetUrl of assetPaths) {
    const match = assetUrl.match(hashedAssetPattern);
    if (!match) continue;

    const [, dir, basename, hash, ext] = match;
    const destPath = resolve(target, 'assets', dir, `${basename}.${hash}.${ext}`);
    if (existsSync(destPath)) continue;

    const sourcePath = resolve(root, dir, `${basename}.${ext}`);
    if (!existsSync(sourcePath)) {
      console.warn(`Missing source for ${assetUrl}: ${sourcePath}`);
      missing += 1;
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(sourcePath, destPath);
    copied += 1;
  }

  return { copied, missing };
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

const assetPaths = collectReferencedAssets(source);
const { copied, missing } = syncHashedAssets(assetPaths);

console.log('Copied dist-web → firebase/hosting');
console.log(`Synced ${copied} hashed assets${missing ? ` (${missing} missing sources)` : ''}`);
