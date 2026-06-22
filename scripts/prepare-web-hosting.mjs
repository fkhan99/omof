import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist-web');
const target = resolve(root, 'firebase/hosting');

const assetPathPattern = /\/assets\/[^"'\s)]+/g;
const hashedAssetPattern = /^\/assets\/(.+\/)(.+)\.([a-f0-9]{32})\.([a-z0-9]+)$/i;
const ioniconsAssetPattern =
  /\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/Ionicons\.[a-f0-9]{32}\.ttf/;

const WEB_IONICONS_PATH = '/assets/web-fonts/ionicons.ttf';

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
      assetPaths.add(match[0].replace(/\\+$/, ''));
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

function findIoniconsAssetPath(exportDir) {
  for (const jsFile of collectJsFiles(exportDir)) {
    const content = readFileSync(jsFile, 'utf8');
    const match = content.match(ioniconsAssetPattern);
    if (match) return match[0];
  }
  return null;
}

function publishWebFont(sourceAssetPath) {
  const sourceFile = resolve(target, sourceAssetPath.replace(/^\//, ''));
  const destFile = resolve(target, 'assets/web-fonts/ionicons.ttf');
  if (!existsSync(sourceFile)) {
    console.warn(`Ionicons source asset missing: ${sourceFile}`);
    return false;
  }

  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(sourceFile, destFile);
  return true;
}

function buildFontHeadMarkup() {
  return [
    `<link rel="preload" href="${WEB_IONICONS_PATH}" as="font" type="font/ttf" crossorigin="anonymous" />`,
    `<style id="expo-generated-fonts">@font-face{font-family:"ionicons";src:url("${WEB_IONICONS_PATH}") format("truetype");font-display:swap;font-weight:normal;font-style:normal;}</style>`,
  ].join('');
}

function injectFontMarkupIntoHtmlFiles() {
  const markup = buildFontHeadMarkup();
  let updated = 0;

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const filePath = resolve(target, entry.name);
    const html = readFileSync(filePath, 'utf8');
    if (html.includes('id="expo-generated-fonts"')) continue;

    const nextHtml = html.includes('</head>')
      ? html.replace('</head>', `${markup}</head>`)
      : `${markup}${html}`;

    writeFileSync(filePath, nextHtml);
    updated += 1;
  }

  return updated;
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

const assetPaths = collectReferencedAssets(source);
const { copied, missing } = syncHashedAssets(assetPaths);

const ioniconsAssetPath = findIoniconsAssetPath(source);
const publishedWebFont = ioniconsAssetPath ? publishWebFont(ioniconsAssetPath) : false;
const htmlFilesUpdated = publishedWebFont ? injectFontMarkupIntoHtmlFiles() : 0;

console.log('Copied dist-web → firebase/hosting');
console.log(`Synced ${copied} hashed assets${missing ? ` (${missing} missing sources)` : ''}`);
if (publishedWebFont) {
  console.log(`Published Ionicons web font at ${WEB_IONICONS_PATH}`);
  console.log(`Injected font markup into ${htmlFilesUpdated} HTML files`);
} else {
  console.warn('Could not publish Ionicons web font');
}
