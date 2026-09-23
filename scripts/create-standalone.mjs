import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'Vencera-AI-demo.html');
let html = await readFile(resolve(root, 'dist/index.html'), 'utf8');

const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
if (!scriptMatch || !styleMatch) {
  throw new Error('Expected Vite output assets were not found in dist/index.html.');
}

const asset = (path) => resolve(root, 'dist', path.replace(/^\//, ''));
const js = (await readFile(asset(scriptMatch[1]), 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await readFile(asset(styleMatch[1]), 'utf8')).replace(/<\/style/gi, '<\\/style');

html = html.replace(scriptMatch[0], () => `<script type="module">\n${js}\n</script>`);
html = html.replace(styleMatch[0], () => `<style>\n${css}\n</style>`);
await writeFile(output, html, 'utf8');
console.log(`Created ${output}`);
