/**
 * DigitalOcean App Platform: copies static assets into dist/ (build output).
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist');
const skip = new Set(['node_modules', 'dist', 'build.js', 'package.json', 'package-lock.json']);

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (skip.has(name)) continue;
  const src = path.join(root, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(out, name));
}

console.log('Build: copied static files to dist/');
