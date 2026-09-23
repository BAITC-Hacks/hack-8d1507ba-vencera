import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-csv.mjs <source.csv>');
const root = resolve(import.meta.dirname, '..');
const raw = await readFile(source);
const content = raw.toString('utf8').replace(/^\uFEFF/, '');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const [headers, ...records] = parseCsv(content);
const expected = ['id', 'anon_name', 'categories', 'city', 'city_imputed', 'synthetic', 'price_from_kzt', 'price_imputed', 'event_formats', 'languages', 'max_hours', 'busy_dates', 'description'];
if (headers.join('|') !== expected.join('|')) throw new Error('Unexpected CSV columns');
if (records.length !== 66 || records.some((row) => row.length !== headers.length)) throw new Error(`Expected 66 complete profiles; got ${records.length}`);
const list = (value) => value.split('|').map((part) => part.trim()).filter(Boolean);
const profiles = records.map((row) => {
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  return {
    id: record.id, name: record.anon_name, categories: list(record.categories), city: record.city,
    city_imputed: record.city_imputed === 'True', synthetic: record.synthetic === 'True',
    price_from_kzt: Number(record.price_from_kzt), price_imputed: record.price_imputed === 'True',
    event_formats: list(record.event_formats), languages: list(record.languages),
    max_hours: record.max_hours === '' ? null : Number(record.max_hours),
    busy_dates: list(record.busy_dates), description: record.description.trim(),
  };
});
if (new Set(profiles.map((row) => row.id)).size !== 66) throw new Error('Duplicate profile IDs');
const flags = [profiles.filter((row) => row.synthetic).length, profiles.filter((row) => row.city_imputed).length, profiles.filter((row) => row.price_imputed).length];
if (flags.join(',') !== '13,8,18') throw new Error(`Data flags differ from the PDF: ${flags}`);
await mkdir(resolve(root, 'data'), { recursive: true });
await mkdir(resolve(root, 'src/data'), { recursive: true });
await writeFile(resolve(root, 'data/contractors.csv'), raw);
await writeFile(resolve(root, 'src/data/contractors.json'), JSON.stringify(profiles, null, 2) + '\n', 'utf8');
console.log(`Imported ${profiles.length} profiles; flags: ${flags.join('/')}`);
