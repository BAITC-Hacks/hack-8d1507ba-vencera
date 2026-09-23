import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { matchContractors } from './api';
import { demoScenarios, type DemoId } from './demo';
import { dateLabel, hoursLabel, money } from './format';
import type { Contractor, Diagnostics, MatchQuery, MatchResponse } from './types';

type FormState = { city: string; date: string; eventType: string; category: string; budget: string; language: string; duration: string; preference: string; dateFlexible: boolean; budgetFlexible: boolean; languageRequired: boolean };
type Field = Exclude<keyof FormState, 'dateFlexible' | 'budgetFlexible' | 'languageRequired'>;
type Errors = Partial<Record<Field, string>>;

const emptyForm: FormState = { city: '', date: '', eventType: '', category: '', budget: '', language: '', duration: '', preference: '', dateFlexible: false, budgetFlexible: false, languageRequired: true };
const cities = ['Алматы', 'Астана', 'Зарубежье'];
const eventTypes = ['Свадьба', 'Той', 'Корпоратив', 'Конференция', 'Юбилей', 'День рождения'];
const categories = ['Ведущий', 'Фотограф', 'Банкетный зал', 'Ресторан', 'Лайв-бэнд', 'Шоу-программа', 'Видеограф', 'Национальный ансамбль', 'Танцевальный коллектив', 'Загородная площадка', 'Флорист', 'Декоратор', 'Подарки и сувениры', 'Ведущий церемонии', 'Инструменталист', 'Фото и видеобудки', 'Отель'];
const languages = ['Русский', 'Казахский', 'Английский'];
const budgetDisplay = (value: string) => value ? new Intl.NumberFormat('ru-RU').format(Number(value)) : '';

function Icon({ name, size = 20 }: { name: 'spark' | 'arrow' | 'check' | 'calendar' | 'pin' | 'shield' | 'sliders' | 'chevron' | 'close' | 'info' | 'search' | 'clock'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    spark: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/></>,
    arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    shield: <><path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formFromQuery(query: MatchQuery): FormState {
  return { city: query.city, date: query.date, eventType: query.event_type, category: query.category, budget: String(query.budget), language: query.language || '', duration: query.duration ? String(query.duration) : '', preference: query.preference || '', dateFlexible: !(query.must_keep || []).includes('date'), budgetFlexible: !(query.must_keep || []).includes('budget'), languageRequired: (query.must_keep || []).includes('language') };
}

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.city) errors.city = 'Выберите город';
  if (!form.date) errors.date = 'Выберите дату';
  if (!form.eventType) errors.eventType = 'Выберите тип мероприятия';
  if (!form.category) errors.category = 'Выберите категорию';
  const budget = Number(form.budget.replace(/\s/g, ''));
  if (!form.budget || !Number.isFinite(budget) || budget <= 0) errors.budget = 'Укажите бюджет больше 0 ₸';
  if (form.duration && (!Number.isInteger(Number(form.duration)) || Number(form.duration) < 1 || Number(form.duration) > 24)) errors.duration = 'Укажите от 1 до 24 часов';
  return errors;
}

function toQuery(form: FormState): MatchQuery {
  return {
    city: form.city, date: form.date, event_type: form.eventType, category: form.category,
    budget: Number(form.budget.replace(/\s/g, '')),
    ...(form.language && { language: form.language }),
    ...(form.duration && { duration: Number(form.duration) }),
    ...(form.preference.trim() && { preference: form.preference.trim() }),
    must_keep: [...(!form.dateFlexible ? ['date' as const] : []), ...(!form.budgetFlexible ? ['budget' as const] : []), ...(form.language && form.languageRequired ? ['language' as const] : [])],
  };
}

function FieldError({ message, id }: { message?: string; id: string }) {
  return message ? <span id={`${id}-error`} className="field-error">{message}</span> : null;
}

function QualityBadges({ item }: { item: Contractor }) {
  const flags = [
    item.dataQuality.synthetic && 'Синтетический профиль',
    item.dataQuality.city_imputed && 'Город восстановлен в датасете',
    item.dataQuality.price_imputed && 'Цена восстановлена в датасете',
  ].filter(Boolean);
  return flags.length ? <div className="quality-row">{flags.map((flag) => <span className="quality-badge" key={String(flag)}><Icon name="info" size={14}/>{flag}</span>)}</div> : null;
}

function ContractorCard({ item, index, date }: { item: Contractor; index: number; date: string }) {
  return <article className="contractor-card">
    <div className="card-top">
      <div className="card-identity"><div className="rank">{String(index + 1).padStart(2, '0')}</div><div><p className="card-kicker">{item.category} · {item.city}</p><h3>{item.name}</h3></div></div>
      <div className="price-block"><span>от</span><strong>{money(item.price)}</strong><small>стартовая цена</small></div>
    </div>
    <div className="card-facts">
      <span className="fact-positive"><Icon name="check" size={16}/> Свободен {dateLabel(date)}</span>
      {item.languages.length > 0 && <span><Icon name="spark" size={16}/> {item.languages.join(', ')}</span>}
      {item.maxHours !== undefined && <span><Icon name="clock" size={16}/> {item.maxHours === null ? 'Длительность не применяется' : `До ${hoursLabel(item.maxHours)}`}</span>}
    </div>
    <div className="why-block"><div className="why-heading"><Icon name="spark" size={18}/><h4>Почему подходит именно вам</h4></div><p>{item.explanation}</p></div>
    {item.evidence.length > 0 && <div className="evidence" aria-label="Факты рекомендации">{item.evidence.map((fact) => <span className="evidence-chip" key={fact}><Icon name="check" size={13}/>{fact}</span>)}</div>}
    {item.sourceQuote && <div className="source-quote"><strong>Из описания профиля · заявление подрядчика</strong><p>«{item.sourceQuote}»</p></div>}
    {item.unknowns?.map((unknown) => <div className="unknown-note" key={unknown}><strong>Что неизвестно</strong><span>{unknown}</span></div>)}
    {item.followUpQuestion && <p className="follow-up"><strong>Что уточнить:</strong> {item.followUpQuestion}</p>}
    {item.tradeoffs.length > 0 && <div className="tradeoff"><span className="tradeoff-label">Компромисс</span><span>{item.tradeoffs.join(' · ')}</span></div>}
    <QualityBadges item={item}/>
  </article>;
}

const rejectionLabels: Record<string, string> = {
  busy: 'Заняты на выбранную дату', over_budget: 'Выше бюджета', wrong_event_type: 'Другой формат', wrong_language: 'Другой язык', insufficient_duration: 'Не хватает часов',
};

function Rescue({ diagnostics, query }: { diagnostics: Diagnostics | null; query: MatchQuery }) {
  if (diagnostics?.categoryExists === false) return <div className="state-panel empty-panel">
    <div className="state-icon warm"><Icon name="search" size={25}/></div>
    <span className="eyebrow">Категория не найдена</span>
    <h2>В {query.city === 'Алматы' ? 'Алматы' : query.city === 'Астана' ? 'Астане' : query.city} пока нет этой категории</h2>
    <p>В доступных данных нет подрядчиков категории «{query.category}» для выбранного города. Попробуйте другой город или категорию.</p>
  </div>;
  return <div className="state-panel rescue-panel">
    <div className="state-icon warm"><Icon name="sliders" size={25}/></div>
    <span className="eyebrow">Режим помощи</span>
    <h2>Подходящих вариантов пока нет</h2>
    <p>По запросу «{query.category}» в городе {query.city} никто не прошёл все условия на {dateLabel(query.date)}.</p>
    {diagnostics?.totalInCity !== null && diagnostics?.totalInCity !== undefined && <div className="candidate-total"><strong>{diagnostics.totalInCity}</strong><span>профиля этой категории в городе проверено</span></div>}
    {diagnostics && Object.keys(diagnostics.rejected).length > 0 && <div className="rejections"><h3>Почему варианты не подошли</h3><div className="rejection-grid">{Object.entries(diagnostics.rejected).filter(([, value]) => typeof value === 'number' && value > 0).map(([key, value]) => <div className="rejection-item" key={key}><strong>{value}</strong><span>{rejectionLabels[key] || key}</span></div>)}</div></div>}
    {diagnostics?.bestRelaxation && <div className="relaxation"><span className="relaxation-icon"><Icon name="arrow" size={19}/></span><div><span className="small-label">Что можно изменить</span><strong>{diagnostics.bestRelaxation.description}</strong></div></div>}
    {diagnostics?.alternatives && diagnostics.alternatives.length > 0 && <div className="alternatives"><span>Другие варианты</span>{diagnostics.alternatives.map((option, index) => <p key={index}>{option.description}</p>)}</div>}
    {!diagnostics && <p className="muted-note">Сервис не передал подробную диагностику. Измените дату, бюджет или дополнительное условие и попробуйте снова.</p>}
  </div>;
}

function FewerResultsNotice({ diagnostics }: { diagnostics: Diagnostics | null }) {
  const reasons = diagnostics ? Object.entries(diagnostics.rejected)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([key, count]) => `${count} — ${rejectionLabels[key]?.toLowerCase() || key}`) : [];
  return <div className="fewer-notice"><Icon name="info" size={18}/><span>
    Подходящих профилей меньше трёх. Мы показываем все найденные варианты.
    {diagnostics?.totalInCity !== null && diagnostics?.totalInCity !== undefined && ` Всего в городе проверено: ${diagnostics.totalInCity}.`}
    {reasons.length > 0 && ` Не прошли условия: ${reasons.join('; ')}.`}
  </span></div>;
}

export default function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [showOptional, setShowOptional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [requestError, setRequestError] = useState('');
  const [activeDemo, setActiveDemo] = useState<DemoId | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const update = (field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setActiveDemo(null);
  };

  const execute = async (query: MatchQuery) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true); setRequestError(''); setResult(null);
    try {
      const response = await matchContractors(query, controller.signal);
      if (!controller.signal.aborted) setResult(response);
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Не удалось выполнить поиск.';
        setRequestError(error instanceof DOMException && error.name === 'TimeoutError' ? 'Сервис отвечает слишком долго. Попробуйте ещё раз.' : message);
      }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void execute(toQuery(form));
  };

  const selectDemo = (id: DemoId) => {
    const scenario = demoScenarios.find((item) => item.id === id)!;
    setForm(formFromQuery(scenario.query)); setErrors({}); setActiveDemo(id);
    setShowOptional(Boolean(scenario.query.language || scenario.query.duration || scenario.query.preference));
    void execute(scenario.query);
  };

  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demoScenarios.some((scenario) => scenario.id === demo)) selectDemo(demo as DemoId);
  }, []);

  return <div className="app-shell">
    <header className="site-header"><div className="container header-inner"><a className="brand" href="#top" aria-label="Vencera AI — наверх"><span className="brand-mark">V<span>.</span></span><span className="brand-name">vencera<span>AI</span></span></a><nav aria-label="Основная навигация"><a href="#how-it-works">Как это работает</a><a href="#workspace">Подбор</a></nav><div className="header-note"><span className="header-dot"/> Хакатон · MVP</div></div></header>
    <main id="top">
      <section className="hero container"><div className="hero-copy"><div className="hero-eyebrow"><span className="eyebrow-line"/> УМНЫЙ ПОДБОР ПОДРЯДЧИКОВ</div><h1>Ваше событие.<br/><em>Правильные люди.</em><br/>Понятный выбор.</h1><p>До трёх подходящих вариантов с конкретными объяснениями. Видно, кто свободен в дату и чья цена «от» не превышает бюджет.</p><a className="hero-link" href="#workspace">Начать подбор <Icon name="arrow" size={18}/></a></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-card hero-card-main"><span className="mini-label">ПРИМЕР ЗАПРОСА</span><div className="hero-card-row"><span className="mini-square"><Icon name="calendar" size={17}/></span><span>Свадьба в Алматы</span></div><div className="hero-card-row"><span className="mini-square"><Icon name="pin" size={17}/></span><span>30 сентября · до 1 000 000 ₸</span></div></div><div className="hero-card hero-card-match"><span className="match-symbol"><Icon name="check" size={19}/></span><div><strong>Подходит по условиям</strong><span>Факты вместо догадок</span></div></div><div className="hero-monogram">V</div><div className="hero-visual-caption">МЕНЬШЕ ПОИСКА.<br/>БОЛЬШЕ УВЕРЕННОСТИ.</div></div></section>
      <section id="workspace" className="workspace-section"><div className="container"><div className="section-heading"><div><span className="eyebrow">СЕРВИС ПОДБОРА</span><h2>Найдите тех, кому можно доверить событие</h2><p>Заполните условия — мы покажем до трёх вариантов и объясним каждый выбор.</p></div><div className="section-number">01 / 02</div></div>
      <div className="demo-strip"><div className="demo-strip-copy"><span className="demo-icon"><Icon name="spark" size={18}/></span><div><strong>Проверить сценарии</strong><small>Реальные результаты из анонимизированного CSV · 66 профилей</small></div></div><div className="demo-pills">{demoScenarios.map((scenario) => <button type="button" className={`demo-pill ${activeDemo === scenario.id ? 'active' : ''}`} onClick={() => selectDemo(scenario.id)} key={scenario.id}><span>{scenario.title}</span><small>{scenario.subtitle}</small></button>)}</div></div>
      <div className="workspace-grid"><aside className="search-panel"><div className="panel-head"><div><span className="panel-step">ШАГ 01</span><h3>Расскажите о событии</h3></div><div className="panel-icon"><Icon name="sliders" size={20}/></div></div><form onSubmit={submit} noValidate>
        <div className="field-grid"><label className="field"><span>Город <b>*</b></span><select value={form.city} onChange={(event) => update('city', event.target.value)} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'city-error' : undefined}><option value="">Выберите город</option>{cities.map((city) => <option key={city}>{city}</option>)}</select><FieldError id="city" message={errors.city}/></label>
        <label className="field"><span>Дата мероприятия <b>*</b></span><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'date-error' : undefined}/><FieldError id="date" message={errors.date}/></label></div>
        <div className="field-grid"><label className="field"><span>Тип мероприятия <b>*</b></span><select value={form.eventType} onChange={(event) => update('eventType', event.target.value)} aria-invalid={Boolean(errors.eventType)} aria-describedby={errors.eventType ? 'eventType-error' : undefined}><option value="">Выберите формат</option>{eventTypes.map((item) => <option key={item}>{item}</option>)}</select><FieldError id="eventType" message={errors.eventType}/></label>
        <label className="field"><span>Кого ищете <b>*</b></span><select value={form.category} onChange={(event) => update('category', event.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'category-error' : undefined}><option value="">Выберите категорию</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><FieldError id="category" message={errors.category}/></label></div>
        <label className="field"><span>Максимальный бюджет <b>*</b></span><div className="input-suffix"><input type="text" inputMode="numeric" placeholder="Например, 500 000" value={budgetDisplay(form.budget)} onChange={(event) => update('budget', event.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? 'budget-error' : undefined}/><span>₸</span></div><FieldError id="budget" message={errors.budget}/></label>
        <div className="flexibility-controls"><span className="small-label">Что можно менять, если совпадений нет?</span><label><input type="checkbox" checked={form.dateFlexible} onChange={(event) => { setForm((current) => ({ ...current, dateFlexible: event.target.checked })); setActiveDemo(null); }}/> Дату можно перенести</label><label><input type="checkbox" checked={form.budgetFlexible} onChange={(event) => { setForm((current) => ({ ...current, budgetFlexible: event.target.checked })); setActiveDemo(null); }}/> Бюджет можно увеличить</label></div>
        <button className="optional-toggle" type="button" aria-expanded={showOptional} onClick={() => setShowOptional(!showOptional)}><span><Icon name="sliders" size={17}/> Дополнительные пожелания</span><Icon name="chevron" size={18}/></button>
        {showOptional && <div className="optional-fields"><div className="field-grid"><label className="field"><span>Язык</span><select value={form.language} onChange={(event) => update('language', event.target.value)}><option value="">Любой</option>{languages.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Длительность, часов</span><input type="number" min="1" max="24" step="1" placeholder="Не важно" value={form.duration} onChange={(event) => update('duration', event.target.value)} aria-invalid={Boolean(errors.duration)} aria-describedby={errors.duration ? 'duration-error' : undefined}/><FieldError id="duration" message={errors.duration}/></label></div>{form.language && <label className="language-control"><input type="checkbox" checked={form.languageRequired} onChange={(event) => { setForm((current) => ({ ...current, languageRequired: event.target.checked })); setActiveDemo(null); }}/> Выбранный язык обязателен (снимите отметку, если он лишь желателен)</label>}<label className="field"><span>Что для вас важно?</span><textarea rows={3} maxLength={500} placeholder="Например, тонкий юмор и ненавязчивая подача" value={form.preference} onChange={(event) => update('preference', event.target.value)}/><small>Это пожелание помогает сопоставить описания подходящих кандидатов.</small></label></div>}
        <button className="submit-button" type="submit" disabled={loading}><span>{loading ? 'Ищем подходящих...' : 'Найти подрядчиков'}</span><Icon name={loading ? 'search' : 'arrow'} size={20}/></button><p className="form-footnote"><Icon name="shield" size={16}/> Рекомендации основаны на проверяемых условиях</p>
      </form></aside>
      <section className="results-area" aria-live="polite" aria-busy={loading}><div className="results-head"><div><span className="panel-step">ШАГ 02</span><h3>Результат подбора</h3></div>{result && <button className="text-button" type="button" onClick={() => dialogRef.current?.showModal()} disabled={!result.decisionTrace.length}>Как мы получили результат <Icon name="arrow" size={16}/></button>}</div>
      {loading ? <div className="loading-state" role="status"><div className="loading-icon"><Icon name="spark" size={28}/></div><h3>Сопоставляем ваши условия</h3><p>Проверяем формат, бюджет, доступность и пожелания.</p><div className="loading-steps"><span>Условия</span><span>Доступность</span><span>Совпадения</span></div><div className="skeleton-card"><div/><div/><div/><div/></div></div> : requestError ? <div className="state-panel error-panel" role="alert"><div className="state-icon error"><Icon name="info" size={25}/></div><span className="eyebrow">ОШИБКА ПОИСКА</span><h2>Попробуйте ещё раз</h2><p>{requestError}</p><button type="button" className="outline-button" onClick={() => void execute(toQuery(form))}>Повторить поиск <Icon name="arrow" size={17}/></button></div> : result?.status === 'results' ? <div className="results-content"><div className="demo-alert"><Icon name="info" size={17}/> Данные из анонимизированного CSV. Цена указана «от», описания — заявления профилей, не независимая проверка.</div><div className="result-summary"><div><span className="eyebrow">ПОДХОДЯЩИЕ ВАРИАНТЫ</span><h2>Нашли {result.count} {result.count === 1 ? 'подрядчика' : 'подрядчиков'}</h2><p>{result.query.category} · {result.query.city} · {dateLabel(result.query.date)}</p></div><span className="result-count">{String(result.count).padStart(2, '0')} <small>/ 03</small></span></div>{result.sensitivity && <div className="sensitivity-note"><Icon name="sliders" size={17}/>{result.sensitivity}</div>}{result.count < 3 && <FewerResultsNotice diagnostics={result.diagnostics}/>}<div className="cards-list">{result.results.map((item, index) => <ContractorCard item={item} index={index} date={result.query.date} key={item.id}/>)}</div></div> : result?.status === 'unverified_date' ? <div className="state-panel empty-panel"><div className="state-icon warm"><Icon name="calendar" size={25}/></div><span className="eyebrow">ДАТА ВНЕ КАЛЕНДАРЯ</span><h2>Доступность не проверена</h2><p>CSV покрывает только 23.09.2026–31.12.2026. Для выбранной даты мы не можем подтвердить занятость, поэтому не показываем рекомендации как доступные.</p></div> : result && (result.status === 'category_missing' || result.status === 'constraints_blocked') ? <Rescue diagnostics={result.diagnostics} query={result.query}/> : <div className="idle-state"><div className="idle-art"><div className="idle-card idle-a"/><div className="idle-card idle-b"/><div className="idle-card idle-c"><Icon name="spark" size={33}/></div></div><span className="eyebrow">ПОИСК С ОБЪЯСНЕНИЕМ</span><h3>Здесь появится ваш ответ</h3><p>Заполните форму слева. Мы покажем подходящих подрядчиков и факты, на которых основана каждая рекомендация.</p><div className="idle-points"><span><Icon name="check" size={16}/> До трёх вариантов</span><span><Icon name="check" size={16}/> Понятные причины</span><span><Icon name="check" size={16}/> Помощь, если совпадений нет</span></div></div>}
      </section></div></div></section>
      <section id="how-it-works" className="how-section container"><div className="section-heading"><div><span className="eyebrow">ПРОЗРАЧНЫЙ ПОДХОД</span><h2>Решение, которое можно проверить</h2></div><div className="section-number">02 / 02</div></div><div className="how-grid"><article><div className="how-number">01</div><div className="how-icon"><Icon name="sliders" size={23}/></div><h3>Условия без компромиссов</h3><p>Город, формат, цена и доступность проверяются до ранжирования.</p></article><article><div className="how-number">02</div><div className="how-icon"><Icon name="spark" size={23}/></div><h3>Совпадение по смыслу</h3><p>Пожелания помогают выбрать среди тех, кто уже подходит по обязательным условиям.</p></article><article><div className="how-number">03</div><div className="how-icon"><Icon name="shield" size={23}/></div><h3>Объяснение фактами</h3><p>Каждый результат раскрывает конкретные причины и возможные ограничения.</p></article></div></section>
    </main><footer className="site-footer"><div className="container footer-inner"><span className="brand footer-brand"><span className="brand-mark">V<span>.</span></span><span className="brand-name">vencera<span>AI</span></span></span><span>Уверенный выбор начинается с ясных причин.</span><span>Сделано для HackAlem AI · 2026</span></div></footer>
    <dialog ref={dialogRef} className="trace-dialog" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}><div className="dialog-content"><div className="dialog-head"><div><span className="eyebrow">ПРОЗРАЧНОСТЬ</span><h2>Как мы получили результат</h2></div><button className="icon-button" type="button" onClick={() => dialogRef.current?.close()} aria-label="Закрыть"><Icon name="close" size={22}/></button></div>{result?.isDemo && <p className="dialog-demo-note">Числа ниже принадлежат синтетическому демонстрационному сценарию.</p>}<p className="dialog-intro">Этапы проверки для вашего запроса. Каждое число показывает, сколько профилей осталось после условия.</p><ol className="trace-list">{result?.decisionTrace.map((step, index) => <li key={step.key}><span className="trace-index">{String(index + 1).padStart(2, '0')}</span><span>{step.label}</span><strong>{step.count}</strong></li>)}</ol><div className="trace-footer"><Icon name="shield" size={18}/> Итоговый порядок определяется правилами сервиса, а не случайным выбором.</div></div></dialog>
  </div>;
}
