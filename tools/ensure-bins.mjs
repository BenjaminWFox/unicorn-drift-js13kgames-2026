/**
 * js13k-vite-plugins needs ect-bin / advzip-bin vendor binaries.
 * npm sometimes skips their postinstall. Copy from the sibling Rainbow Run
 * install when the files are missing.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sibling = resolve(root, '../../rainbow run/code/node_modules');

function ensure(pkg, file) {
  const destDir = resolve(root, 'node_modules', pkg, 'vendor');
  const dest = resolve(destDir, file);
  if (existsSync(dest)) {
    return;
  }
  const src = resolve(sibling, pkg, 'vendor', file);
  if (!existsSync(src)) {
    console.warn('ensure-bins: missing', dest, '(and no sibling copy at', src + ')');
    return;
  }
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log('ensure-bins: copied', file);
}

ensure('ect-bin', 'ect');
ensure('advzip-bin', 'advzip');
