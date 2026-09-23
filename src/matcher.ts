import rawProfiles from './data/contractors.json' with { type: 'json' };
import type { Contractor, Diagnostics, MatchQuery, MatchResponse, Relaxation, TraceStep } from './types';

type Profile = {
  id: string; name: string; categories: string[]; city: string; city_imputed: boolean;
  synthetic: boolean; price_from_kzt: number; price_imputed: boolean;
  event_formats: string[]; languages: string[]; max_hours: number | null;
  busy_dates: string[]; description: string;
};

const profiles = rawProfiles as Profile[];
const FIRST_DATE = '2026-09-23';
const LAST_DATE = '2026-12-31';
const SCORING_VERSION = 'csv-v1';
const norm = (value: string) => value.trim().toLocaleLowerCase('ru-RU');
const has = (values: string[], desired: string) => values.some((value) => norm(value) === norm(desired));
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const formatMoney = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;
const tokens = (value: string) => [...new Set(norm(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4).map((word) => word.slice(0, 4)))];

function preferenceScore(profile: Profile, query: MatchQuery): number {
  const desired = tokens(query.preference || '');
  if (!desired.length) return 0;
  const description = norm(profile.description);
  return desired.filter((word) => description.includes(word)).length;
}

function quoteFor(profile: Profile, query: MatchQuery): string {
  const sentences = profile.description.replace(/[\u0000-\u001f]+/g, ' ').split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const desired = tokens(query.preference || '');
  const matching = sentences.find((sentence) => desired.some((word) => norm(sentence).includes(word)));
  const selected = matching || sentences[0] || profile.description.trim();
  return selected.length > 220 ? `${selected.slice(0, 217).trimEnd()}…` : selected;
}

function toContractor(profile: Profile, query: MatchQuery): Contractor {
  const languageMatches = !query.language || has(profile.languages, query.language);
  const evidence = [
    `Формат: ${query.event_type.toLocaleLowerCase('ru-RU')}`,
    `Цена от ${formatMoney(profile.price_from_kzt)} ≤ бюджет`,
    `Свободен ${query.date}`,
    ...(query.language && languageMatches ? [`Язык: ${query.language.toLocaleLowerCase('ru-RU')}`] : []),
    ...(query.duration && profile.max_hours !== null ? [`До ${profile.max_hours} ч`] : []),
  ];
  const tradeoffs = query.language && !languageMatches ? [`Язык ${query.language.toLocaleLowerCase('ru-RU')} не указан в профиле; вы отметили его как желательный`] : [];
  const explanation = `Профиль подходит по городу, категории, формату и доступности на ${query.date}. Стартовая цена ${formatMoney(profile.price_from_kzt)} не превышает ваш бюджет${query.duration && profile.max_hours !== null ? `; указанный предел — ${profile.max_hours} ч` : ''}.`;
  return {
    id: profile.id, name: profile.name, category: query.category, city: profile.city,
    price: profile.price_from_kzt, available: true, languages: profile.languages,
    maxHours: profile.max_hours, explanation, evidence, tradeoffs,
    sourceQuote: quoteFor(profile, query),
    unknowns: [`Итоговая стоимость и состав услуг не подтверждены: в CSV указана только цена от ${formatMoney(profile.price_from_kzt)}.`],
    followUpQuestion: `Что входит в цену от ${formatMoney(profile.price_from_kzt)} и какова итоговая смета для этого события?`,
    dataQuality: { synthetic: profile.synthetic, city_imputed: profile.city_imputed, price_imputed: profile.price_imputed },
  };
}

function baseReason(profile: Profile, query: MatchQuery): keyof Diagnostics['rejected'] | null {
  if (!has(profile.event_formats, query.event_type)) return 'wrong_event_type';
  if (profile.price_from_kzt > query.budget) return 'over_budget';
  if (query.language && (query.must_keep || []).includes('language') && !has(profile.languages, query.language)) return 'wrong_language';
  if (query.duration && profile.max_hours !== null && profile.max_hours < query.duration) return 'insufficient_duration';
  if (profile.busy_dates.includes(query.date)) return 'busy';
  return null;
}

function nextDate(query: MatchQuery, pool: Profile[]): string | null {
  if ((query.must_keep || []).includes('date')) return null;
  const current = new Date(`${query.date}T00:00:00Z`);
  for (let offset = 1; offset <= 99; offset++) {
    const date = new Date(current.getTime() + offset * 86400000).toISOString().slice(0, 10);
    if (date > LAST_DATE) break;
    if (pool.some((profile) => baseReason(profile, { ...query, date }) === null)) return date;
  }
  return null;
}

function budgetAlternative(query: MatchQuery, pool: Profile[]): number | null {
  if ((query.must_keep || []).includes('budget')) return null;
  const prices = pool.filter((profile) => profile.price_from_kzt > query.budget && baseReason(profile, { ...query, budget: profile.price_from_kzt }) === null).map((profile) => profile.price_from_kzt);
  return prices.length ? Math.min(...prices) : null;
}

function traceStep(key: string, label: string, count: number): TraceStep { return { key, label, count }; }

export function matchLocal(query: MatchQuery): MatchResponse {
  if (!query.city || !query.category || !query.event_type || !isoDate(query.date) || !Number.isInteger(query.budget) || query.budget <= 0 || (query.duration !== undefined && (!Number.isInteger(query.duration) || query.duration < 1 || query.duration > 24))) {
    throw new Error('Проверьте город, дату, формат, категорию и бюджет.');
  }
  const city = profiles.filter((profile) => norm(profile.city) === norm(query.city));
  const pool = city.filter((profile) => has(profile.categories, query.category));
  const event = pool.filter((profile) => has(profile.event_formats, query.event_type));
  const budget = event.filter((profile) => profile.price_from_kzt <= query.budget);
  const language = query.language && (query.must_keep || []).includes('language') ? budget.filter((profile) => has(profile.languages, query.language!)) : budget;
  const duration = query.duration ? language.filter((profile) => profile.max_hours === null || profile.max_hours >= query.duration!) : language;
  const inCalendar = query.date >= FIRST_DATE && query.date <= LAST_DATE;
  const available = inCalendar ? duration.filter((profile) => !profile.busy_dates.includes(query.date)) : [];
  const decisionTrace = [
    traceStep('total', 'Все профили CSV', profiles.length), traceStep('city', 'Город', city.length),
    traceStep('category', 'Категория', pool.length), traceStep('event_type', 'Формат', event.length),
    traceStep('budget', 'Цена от ≤ бюджет', budget.length), traceStep('language', 'Обязательный язык', language.length),
    traceStep('duration', 'Длительность', duration.length),
    traceStep('availability', inCalendar ? 'Свободны в дату' : 'Дата вне календаря CSV', available.length),
  ];
  const rejected: Diagnostics['rejected'] = {};
  if (inCalendar) for (const profile of pool) {
    const reason = baseReason(profile, query);
    if (reason) rejected[reason] = (rejected[reason] || 0) + 1;
  }
  const alternatives: Relaxation[] = [];
  if (inCalendar && pool.length) {
    const date = nextDate(query, pool);
    if (date) alternatives.push({ type: 'date', value: date, description: `Перенос на ${date} даёт подходящий профиль; дата отмечена как гибкая.` });
    const price = budgetAlternative(query, pool);
    if (price !== null) alternatives.push({ type: 'budget', value: price, description: `При лимите от ${formatMoney(price)} появляется подходящий профиль; бюджет отмечен как гибкий.` });
  }
  const diagnostics: Diagnostics = { categoryExists: pool.length > 0, totalInCity: pool.length, rejected, bestRelaxation: alternatives[0] || null, alternatives: alternatives.slice(1) };
  const ranked = [...available].sort((a, b) => preferenceScore(b, query) - preferenceScore(a, query) || a.price_from_kzt - b.price_from_kzt || a.id.localeCompare(b.id));
  const results = ranked.slice(0, 3).map((profile) => toContractor(profile, query));
  decisionTrace.push(traceStep('selected', 'Показано', results.length));
  let sensitivity: string | undefined;
  if (inCalendar && query.duration && available.length) {
    const nextHours = query.duration + 2;
    const nextCount = available.filter((profile) => profile.max_hours === null || profile.max_hours >= nextHours).length;
    sensitivity = `Если длительность увеличить с ${query.duration} до ${nextHours} ч, структурированным условиям будут соответствовать ${nextCount} из ${available.length} профилей.`;
  }
  return {
    status: !inCalendar ? 'unverified_date' : !pool.length ? 'category_missing' : results.length ? 'results' : 'constraints_blocked',
    query, results, count: results.length, decisionTrace, diagnostics, isDemo: false,
    sensitivity, scoringVersion: SCORING_VERSION,
  };
}
