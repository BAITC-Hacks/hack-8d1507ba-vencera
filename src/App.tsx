import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { matchContractors } from './api';
import { money } from './format';
import type { MatchQuery, MatchResponse } from './types';

type Step = 'event' | 'city' | 'category' | 'date' | 'budget' | 'language' | 'duration' | 'preference' | 'results';
type Message = { role: 'assistant' | 'user'; text: string };

const events = ['Свадьба', 'Той', 'Корпоратив', 'День рождения'];
const cities = ['Алматы', 'Астана'];
const categories = ['Ведущий', 'Фотограф', 'Флорист', 'Ведущий церемонии', 'Декоратор', 'Лайв-бэнд', 'Ресторан', 'Видеограф', 'Национальный ансамбль', 'Банкетный зал'];
const initialMessages: Message[] = [{ role: 'assistant', text: 'Добро пожаловать. Что будем создавать?' }];

function Icon({ name, size = 18 }: { name: 'arrow' | 'spark' | 'menu' | 'close' | 'plus' | 'check'; size?: number }) {
  const shapes: Record<typeof name, ReactNode> = {
    arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
    spark: <><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/></>,
    menu: <><path d="M4 7h16M4 17h16"/></>, close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>, check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

function Logo({ light = false }: { light?: boolean }) {
  return <a className={`wordmark${light ? ' wordmark-light' : ''}`} href="#top" aria-label="Vencera — наверх"><span>v</span>encera<sup>®</sup></a>;
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { element.classList.add('is-visible'); observer.disconnect(); }
    }, { threshold: 0.13 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function ConciergeChat() {
  const [step, setStep] = useState<Step>('event');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [query, setQuery] = useState<Partial<MatchQuery>>({ must_keep: ['date', 'budget', 'language'] });
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [date, setDate] = useState('2026-09-30');
  const [budget, setBudget] = useState('1000000');
  const [languageRequired, setLanguageRequired] = useState(true);
  const [dateFlexible, setDateFlexible] = useState(false);
  const [budgetFlexible, setBudgetFlexible] = useState(false);
  const [preference, setPreference] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, result]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const advance = (answer: string, patch: Partial<MatchQuery>, next: Step, prompt: string) => {
    setMessages((current) => [...current, { role: 'user', text: answer }]);
    setTyping(true);
    timerRef.current = window.setTimeout(() => {
      const updated = { ...query, ...patch };
      setQuery(updated);
      setStep(next);
      setTyping(false);
      if (next === 'results') {
        void matchContractors(updated as MatchQuery).then((response) => {
          setResult(response);
          const line = response.status === 'results'
            ? `Подбор готов. ${response.count} ${response.count === 1 ? 'вариант' : 'варианта'} из реальных профилей каталога.`
            : response.status === 'category_missing' ? 'В этом городе такой категории пока нет в каталоге.'
              : response.status === 'unverified_date' ? 'На эту дату календарь доступности не содержит данных.'
                : 'Пока нет профилей, которые проходят все выбранные условия.';
          setMessages((current) => [...current, { role: 'assistant', text: line }]);
        }).catch(() => setMessages((current) => [...current, { role: 'assistant', text: 'Не получилось завершить подбор. Попробуйте ещё раз.' }]));
      } else setMessages((current) => [...current, { role: 'assistant', text: prompt }]);
    }, 480);
  };

  const startSearch = (note: string) => {
    const mustKeep: MatchQuery['must_keep'] = [
      ...(!dateFlexible ? ['date' as const] : []),
      ...(!budgetFlexible ? ['budget' as const] : []),
      ...(query.language && languageRequired ? ['language' as const] : []),
    ];
    advance(note, { date, budget: Number(budget), preference: preference.trim() || undefined, must_keep: mustKeep }, 'results', 'Сверяю факты каталога…');
  };

  const reset = () => {
    window.clearTimeout(timerRef.current);
    setStep('event'); setMessages(initialMessages); setQuery({ must_keep: ['date', 'budget', 'language'] }); setResult(null); setTyping(false);
    setDate('2026-09-30'); setBudget('1000000'); setLanguageRequired(true); setDateFlexible(false); setBudgetFlexible(false); setPreference('');
  };

  const submitPreference = (event: FormEvent) => {
    event.preventDefault();
    startSearch(preference.trim() || 'Без дополнительных пожеланий');
  };

  return <>
    <header className="site-nav">
      <div className="nav-inner"><Logo light/>
        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'} aria-label="Главная навигация">
          <a href="#vision" onClick={() => setMobileMenu(false)}>Подход</a><a href="#method" onClick={() => setMobileMenu(false)}>Как работает</a><a href="#categories" onClick={() => setMobileMenu(false)}>Категории</a>
        </nav>
        <a className="nav-cta" href="#concierge">Начать подбор <Icon name="arrow" size={15}/></a>
        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? 'Закрыть меню' : 'Открыть меню'}><Icon name={mobileMenu ? 'close' : 'menu'} size={22}/></button>
      </div>
    </header>
    <main id="top">
      <section className="hero" aria-label="Vencera">
        <div className="hero-image"/>
        <div className="hero-grain"/>
        <div className="hero-inner">
          <div className="hero-overline"><span className="live-dot"/> КОНСЬЕРЖ СОБЫТИЙ · КАЗАХСТАН</div>
          <h1>Событие.<br/><em>В вашем</em><br/>почерке.</h1>
          <p>Скажите, что для вас важно.<br/>Остальное мы соберём.</p>
          <a className="hero-button" href="#concierge"><span>Создать событие</span><span className="button-icon"><Icon name="arrow" size={17}/></span></a>
          <div className="hero-meta"><span>ОТ ИДЕИ ДО ВЕРНОГО ВЫБОРА</span><span>01 — 04</span></div>
        </div>
        <a href="#vision" className="scroll-cue" aria-label="Прокрутить вниз"><span/><small>ЛИСТАЙТЕ</small></a>
        <div className="hero-index">V / 26</div>
      </section>

      <section className="manifesto section-pad" id="vision">
        <div className="section-label"><span>01 / ФИЛОСОФИЯ</span><span>VENCERA, 2026</span></div>
        <div className="manifesto-grid">
          <Reveal className="manifesto-title"><span className="eyebrow">МЕНЬШЕ ШУМА. БОЛЬШЕ СМЫСЛА.</span><h2>Красивое событие<br/>начинается с <em>ясности.</em></h2></Reveal>
          <Reveal className="manifesto-copy" delay={120}><span className="serif-mark">“</span><p>Не бесконечный список подрядчиков. Три подходящих варианта — и факты, которые помогут выбрать.</p><a className="underlined-link" href="#concierge">Познакомиться с Vencera <Icon name="arrow" size={15}/></a></Reveal>
        </div>
        <div className="manifesto-rule"><span/><span>МЫ ПОМНИМ ГЛАВНОЕ</span><span/></div>
      </section>

      <section className="method-section section-pad" id="method">
        <div className="section-label section-label-light"><span>02 / ПОДХОД</span><span>СПОКОЙНО. ТОЧНО. ПРОЗРАЧНО.</span></div>
        <div className="method-heading"><Reveal><span className="eyebrow eyebrow-light">ВАШ ЗАПРОС — НАША КАРТА</span><h2>От мысли<br/>к <em>моменту.</em></h2></Reveal><Reveal delay={100}><p>Каждый шаг понятен.<br/>Каждый выбор — ваш.</p></Reveal></div>
        <Reveal className="process-wrap">
          <svg className="process-line" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 46 C180 46 165 20 330 20 S490 72 600 46 790 20 900 20 1060 72 1200 46"/><circle cx="0" cy="46" r="4"/><circle cx="330" cy="20" r="4"/><circle cx="600" cy="46" r="4"/><circle cx="900" cy="20" r="4"/><circle cx="1200" cy="46" r="4"/></svg>
          <div className="process-grid">
            {[
              ['01', 'Расскажите', 'Город, дата, настроение. Начнём с того, что для вас важно.'],
              ['02', 'Сверим факты', 'Формат, цена «от», язык и календарь проверяются по данным.'],
              ['03', 'Покажем выбор', 'До трёх подходящих профилей. Без скрытого рейтинга.'],
              ['04', 'Решаете вы', 'Видите основания, пробелы и следующий вопрос.'],
            ].map(([number, title, copy], index) => <Reveal className="process-step" key={number} delay={index * 90}><span className="step-number">{number}</span><span className="step-orbit"><i/></span><h3>{title}</h3><p>{copy}</p></Reveal>)}
          </div>
        </Reveal>
        <div className="method-foot"><span><Icon name="spark" size={15}/> AI ПОМОГАЕТ. РЕШАЕТЕ ВЫ.</span><span>ОСНОВАНО НА ФАКТАХ ПРОФИЛЯ</span></div>
      </section>

      <section className="concierge-section section-pad" id="concierge">
        <div className="section-label"><span>03 / VENCERA CONCIERGE</span><span>ВАШ РАЗГОВОР НАЧИНАЕТСЯ ЗДЕСЬ</span></div>
        <div className="concierge-heading"><Reveal><span className="eyebrow">ТИХАЯ УВЕРЕННОСТЬ В КАЖДОЙ ДЕТАЛИ</span><h2>Не форма.<br/><em>Разговор.</em></h2><p>В несколько спокойных шагов<br/>найдём подходящих людей.</p></Reveal>
          <Reveal className="concierge-note" delay={140}><div className="orbit-mark"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="40"/><circle cx="60" cy="60" r="25"/><path d="M60 7v106M7 60h106"/><circle cx="60" cy="20" r="4"/></svg><Icon name="spark" size={22}/></div><span>ЛИЧНОЕ СОПРОВОЖДЕНИЕ<br/>НА ОСНОВЕ РЕАЛЬНЫХ ДАННЫХ</span></Reveal>
        </div>
        <Reveal className="chat-shell" delay={80}>
          <div className="chat-topbar"><div className="chat-presence"><span className="presence-dot"/><div><strong>Vencera</strong><small>ваш AI-консьерж</small></div></div><span className="chat-session">СЕССИЯ 001</span><button className="chat-reset" onClick={reset} aria-label="Начать новый подбор"><Icon name="plus" size={19}/></button></div>
          <div className="chat-body" ref={scrollRef} aria-live="polite">
            <div className="chat-date">НОВАЯ ИСТОРИЯ <span/> 1 МИН</div>
            {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.text}`}><span className="message-avatar">{message.role === 'assistant' ? 'v.' : 'вы'}</span><div className="message-content"><span className="message-author">{message.role === 'assistant' ? 'VENCERA' : 'ВАШ ОТВЕТ'}</span><p>{message.text}</p></div></div>)}
            {typing && <div className="chat-message assistant typing-message"><span className="message-avatar">v.</span><div className="typing-bubble"><i/><i/><i/></div></div>}
            {result && <div className="chat-outcome">
              {result.status === 'results' && result.results.map((item, index) => <details className="chat-result-card" key={item.id} open={index === 0}><summary><span className="chat-rank">0{index + 1}</span><span className="chat-result-name"><strong>{item.name}</strong><small>{item.category} · {item.city}</small></span><span className="chat-price">от {money(item.price)}</span></summary><div className="chat-result-detail"><p>{item.explanation}</p>{item.sourceQuote && <blockquote>«{item.sourceQuote}»</blockquote>}<span className="chat-unknown">Неизвестно: итоговая смета и состав услуг.</span>{item.dataQuality.synthetic && <span className="chat-synthetic">СИНТЕТИЧЕСКИЙ ПРОФИЛЬ</span>}</div></details>)}
              {result.status !== 'results' && <div className="chat-empty"><span>{result.status === 'unverified_date' ? 'ДОСТУПНОСТЬ НЕ ПРОВЕРЕНА' : result.status === 'category_missing' ? 'КАТЕГОРИЯ НЕ НАЙДЕНА' : 'ПОКА НЕТ СОВПАДЕНИЙ'}</span><p>{result.diagnostics?.bestRelaxation?.description || 'Можно изменить одно из условий и повторить подбор.'}</p></div>}
              <details className="chat-trace"><summary>Как мы получили этот результат <span>+</span></summary><ol>{result.decisionTrace.map((trace) => <li key={trace.key}><span>{trace.label}</span><strong>{trace.count}</strong></li>)}</ol></details>
              <p className="chat-disclaimer">Цена — стартовая. Описание — заявление профиля, а не независимая проверка.</p>
            </div>}
          </div>
          <div className="chat-input-area">
            {!result && step === 'event' && <div className="choice-group"><span className="input-label">ЧТО ОТМЕЧАЕМ?</span><div className="choice-list">{events.map((item) => <button key={item} onClick={() => advance(item, { event_type: item }, 'city', 'В каком городе пройдёт событие?')}>{item}<Icon name="arrow" size={14}/></button>)}</div></div>}
            {!result && step === 'city' && <div className="choice-group"><span className="input-label">В КАКОМ ГОРОДЕ?</span><div className="choice-list">{cities.map((item) => <button key={item} onClick={() => advance(item, { city: item }, 'category', 'Кого ищем для этого события?')}>{item}<Icon name="arrow" size={14}/></button>)}</div></div>}
            {!result && step === 'category' && <div className="choice-group"><span className="input-label">КАКОЙ СПЕЦИАЛИСТ?</span><div className="category-chips">{categories.map((item) => <button key={item} onClick={() => advance(item, { category: item }, 'date', 'На какую дату планируем?')}>{item}</button>)}</div></div>}
            {!result && step === 'date' && <div className="chat-fields"><label><span className="input-label">ДАТА СОБЫТИЯ</span><input type="date" min="2026-09-23" max="2026-12-31" value={date} onChange={(event) => setDate(event.target.value)}/></label><label className="chat-check"><input type="checkbox" checked={dateFlexible} onChange={(event) => setDateFlexible(event.target.checked)}/> Дата может измениться</label><button className="chat-send" onClick={() => advance(new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU'), { date }, 'budget', 'Какой бюджет закладываем?')}>Продолжить <Icon name="arrow" size={16}/></button></div>}
            {!result && step === 'budget' && <div className="chat-fields"><label><span className="input-label">МАКСИМАЛЬНЫЙ БЮДЖЕТ · ₸</span><input type="number" min="50000" step="50000" value={budget} onChange={(event) => setBudget(event.target.value)}/></label><label className="chat-check"><input type="checkbox" checked={budgetFlexible} onChange={(event) => setBudgetFlexible(event.target.checked)}/> Бюджет можно увеличить</label><button className="chat-send" onClick={() => advance(`${new Intl.NumberFormat('ru-RU').format(Number(budget))} ₸`, { budget: Number(budget) }, 'language', 'На каком языке должен работать специалист?')}>Продолжить <Icon name="arrow" size={16}/></button></div>}
            {!result && step === 'language' && <div className="choice-group"><span className="input-label">ЯЗЫК · ВЫБЕРИТЕ НАСКОЛЬКО ЭТО ВАЖНО</span><div className="choice-list">{[{ label: 'Русский · обязателен', language: 'Русский', required: true }, { label: 'Русский · желателен', language: 'Русский', required: false }, { label: 'Казахский · обязателен', language: 'Казахский', required: true }, { label: 'Казахский · желателен', language: 'Казахский', required: false }, { label: 'Любой язык', language: undefined, required: false }].map((item) => <button key={item.label} onClick={() => { setLanguageRequired(item.required); advance(item.label, { language: item.language, must_keep: ['date', 'budget', ...(item.language && item.required ? ['language' as const] : [])] }, 'duration', 'Сколько часов нужен специалист?') }}>{item.label}<Icon name="arrow" size={14}/></button>)}</div></div>}
            {!result && step === 'duration' && <div className="choice-group"><span className="input-label">ДЛИТЕЛЬНОСТЬ</span><div className="choice-list">{[['3 часа', 3], ['8 часов', 8], ['Не важно', undefined]] .map(([label, value]) => <button key={String(label)} onClick={() => advance(String(label), { duration: value as number | undefined }, 'preference', 'И последнее. Какое ощущение должно остаться?')}>{label}<Icon name="arrow" size={14}/></button>)}</div></div>}
            {!result && step === 'preference' && <form className="chat-compose" onSubmit={submitPreference}><label htmlFor="preference-input" className="input-label">ОДНА ДЕТАЛЬ, КОТОРАЯ ВАЖНА</label><textarea id="preference-input" rows={2} maxLength={240} placeholder="Тонкий юмор. Тихая элегантность. Без навязчивых конкурсов…" value={preference} onChange={(event) => setPreference(event.target.value)}/><button className="chat-send" type="submit">Найти мой выбор <Icon name="arrow" size={16}/></button><small>Можно оставить поле пустым</small></form>}
            {result && <button className="restart-button" onClick={reset}>Создать новый подбор <Icon name="plus" size={16}/></button>}
          </div>
          <div className="chat-bottom"><span><Icon name="spark" size={13}/> СОЗДАНО С ВНИМАНИЕМ</span><span>ВАШИ ДАННЫЕ ОСТАЮТСЯ У ВАС</span></div>
        </Reveal>
      </section>

      <section className="categories-section section-pad" id="categories">
        <div className="section-label"><span>04 / ПРОСТРАНСТВО ВОЗМОЖНОСТЕЙ</span><span>ВАША ИСТОРИЯ, ВАШИ ЛЮДИ</span></div>
        <div className="categories-heading"><Reveal><span className="eyebrow">ВЫБОР НАЧИНАЕТСЯ С ИДЕИ</span><h2>Для моментов,<br/><em>которые важны.</em></h2></Reveal><Reveal delay={120}><p>От первого тоста<br/>до последнего танца.</p></Reveal></div>
        <Reveal className="category-wall">{categories.slice(0, 9).map((name, index) => <a href="#concierge" key={name}><span>0{index + 1}</span><strong>{name}</strong><Icon name="arrow" size={18}/></a>)}</Reveal>
      </section>
    </main>
    <footer className="footer"><div className="footer-top"><Logo light/><span>СОБЫТИЯ, КОТОРЫЕ ОСТАЮТСЯ.</span><a href="#top">НАВЕРХ ↑</a></div><div className="footer-bottom"><span>© VENCERA 2026</span><span>СДЕЛАНО В КАЗАХСТАНЕ</span><span>AI КАК ИНСТРУМЕНТ. ВЫБОР ЗА ВАМИ.</span></div></footer>
  </>;
}

export default function App() {
  return <div className="site-shell"><ConciergeChat/></div>;
}
