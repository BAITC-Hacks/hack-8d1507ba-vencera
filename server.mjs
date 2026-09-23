import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchLocal } from './src/matcher.ts';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function sendJson(response, code, value) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function queryFrom(body) {
  return {
    city: body.city, date: body.date, event_type: body.event_type, category: body.category,
    budget: body.budget_kzt ?? body.budget, language: body.language,
    duration: body.duration_hours ?? body.duration,
    preference: Array.isArray(body.preferences) ? body.preferences.join(' ') : body.preference,
    must_keep: Array.isArray(body.must_keep) ? body.must_keep : ['date', 'budget', ...(body.language ? ['language'] : [])],
  };
}

function apiResponse(result) {
  return {
    status: result.status,
    results: result.results.map((profile) => ({
      id: profile.id, name: profile.name, category: profile.category, city: profile.city,
      price_from_kzt: profile.price, available: profile.available, explanation: profile.explanation,
      evidence: [
        { field: 'city', value: profile.city, kind: 'structured' },
        { field: 'price_from_kzt', value: profile.price, kind: 'structured' },
        { field: 'availability', value: result.query.date, kind: 'structured' },
        ...(profile.sourceQuote ? [{ field: 'description', quote: profile.sourceQuote, kind: 'source_text' }] : []),
      ],
      portfolio_matches: [], unknowns: profile.unknowns || [],
      follow_up_question: profile.followUpQuestion || null, data_flags: profile.dataQuality,
    })),
    decision_trace: result.decisionTrace, diagnostics: result.diagnostics,
    scoring_version: result.scoringVersion, sensitivity: result.sensitivity || null,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/match') {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'POST required' });
    try {
      let text = '';
      for await (const chunk of request) {
        text += chunk;
        if (text.length > 32768) return sendJson(response, 413, { error: 'Request too large' });
      }
      const body = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON object');
      return sendJson(response, 200, apiResponse(matchLocal(queryFrom(body))));
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid request' });
    }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return sendJson(response, 400, { error: 'Invalid path' }); }
  const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (path !== root && !path.startsWith(root + sep)) return sendJson(response, 403, { error: 'Forbidden' });
  try {
    if (!(await stat(path)).isFile()) return sendJson(response, 404, { error: 'Not found' });
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { sendJson(response, 404, { error: 'Not found' }); }
});

server.listen(port, host, () => console.log(`Vencera AI at http://${host}:${port}`));
