import test from 'node:test';
import assert from 'node:assert/strict';
import profiles from '../src/data/contractors.json' with { type: 'json' };
import { matchLocal } from '../src/matcher.ts';

const popular = { city: 'Алматы', date: '2026-09-30', event_type: 'свадьба', category: 'Ведущий', budget: 1000000, language: 'русский', duration: 8, must_keep: ['date', 'budget', 'language'] };
const count = (response, key) => response.decisionTrace.find((step) => step.key === key)?.count;

test('CSV counts and exact 8/10-hour scenarios', () => {
  assert.equal(profiles.length, 66);
  assert.equal(profiles.filter((row) => row.synthetic).length, 13);
  assert.equal(profiles.filter((row) => row.city_imputed).length, 8);
  assert.equal(profiles.filter((row) => row.price_imputed).length, 18);
  const eight = matchLocal(popular);
  const ten = matchLocal({ ...popular, duration: 10 });
  assert.equal(count(eight, 'availability'), 5);
  assert.equal(count(ten, 'availability'), 3);
  assert.equal(eight.results.length, 3);
  assert.equal(ten.results.length, 3);
  assert.deepEqual(eight.results.map((row) => row.id), matchLocal(popular).results.map((row) => row.id));
});

test('all returned profiles are eligible and evidence is source-backed', () => {
  const response = matchLocal(popular);
  for (const result of response.results) {
    const original = profiles.find((row) => row.id === result.id);
    assert.ok(original);
    assert.ok(!original.busy_dates.includes(popular.date));
    assert.ok(result.price <= popular.budget);
    assert.ok(original.description.includes(result.sourceQuote.replace(/…$/, '')));
  }
});

test('rare category shows actual count and a synthetic flag', () => {
  const result = matchLocal({ city: 'Алматы', date: '2026-09-24', event_type: 'свадьба', category: 'Ведущий церемонии', budget: 300000, language: 'русский', duration: 3, must_keep: ['date', 'budget', 'language'] });
  assert.equal(result.status, 'results');
  assert.equal(result.results.length, 2);
  assert.ok(result.results.some((row) => row.dataQuality.synthetic));
});

test('busy florist is excluded and fixed date is respected', () => {
  const query = { city: 'Астана', date: '2026-09-24', event_type: 'свадьба', category: 'Флорист', budget: 300000, must_keep: ['budget'] };
  const flexible = matchLocal(query);
  const fixed = matchLocal({ ...query, must_keep: ['budget', 'date'] });
  assert.equal(flexible.status, 'constraints_blocked');
  assert.equal(flexible.results.length, 0);
  assert.equal(flexible.diagnostics.bestRelaxation?.value, '2026-09-25');
  assert.equal(fixed.diagnostics.bestRelaxation, null);
  assert.deepEqual(fixed.diagnostics.alternatives, []);
});

test('missing category and out-of-calendar date are distinct', () => {
  const missing = matchLocal({ city: 'Астана', date: '2026-09-24', event_type: 'свадьба', category: 'Инструменталист', budget: 300000, must_keep: ['date', 'budget'] });
  const outside = matchLocal({ ...popular, date: '2027-01-01' });
  assert.equal(missing.status, 'category_missing');
  assert.equal(outside.status, 'unverified_date');
  assert.equal(outside.results.length, 0);
});
