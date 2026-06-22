import { cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist-web');
const target = resolve(root, 'firebase/hosting');

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log('Copied dist-web → firebase/hosting');
