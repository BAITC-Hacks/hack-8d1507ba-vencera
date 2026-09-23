import type { MatchQuery } from './types';

export type DemoId = 'popular' | 'duration' | 'rare' | 'rescue' | 'missing';

export const demoScenarios: { id: DemoId; title: string; subtitle: string; query: MatchQuery }[] = [
  {
    id: 'popular', title: 'Плотная категория', subtitle: '5 подходят · 3 показаны',
    query: { city: 'Алматы', date: '2026-09-30', event_type: 'Свадьба', category: 'Ведущий', budget: 1000000, language: 'Русский', duration: 8, preference: 'тонкий юмор', must_keep: ['date', 'budget', 'language'] },
  },
  {
    id: 'duration', title: 'Проверка 10 часов', subtitle: '3 подходят',
    query: { city: 'Алматы', date: '2026-09-30', event_type: 'Свадьба', category: 'Ведущий', budget: 1000000, language: 'Русский', duration: 10, must_keep: ['date', 'budget', 'language'] },
  },
  {
    id: 'rare', title: 'Редкая категория', subtitle: 'Реальный результат CSV',
    query: { city: 'Алматы', date: '2026-09-24', event_type: 'Свадьба', category: 'Ведущий церемонии', budget: 300000, language: 'Русский', duration: 3, must_keep: ['date', 'budget', 'language'] },
  },
  {
    id: 'rescue', title: 'Занятый флорист', subtitle: 'Допустимый перенос',
    query: { city: 'Астана', date: '2026-09-24', event_type: 'Свадьба', category: 'Флорист', budget: 300000, must_keep: ['budget'] },
  },
  {
    id: 'missing', title: 'Категории нет', subtitle: 'Отдельное состояние',
    query: { city: 'Астана', date: '2026-09-24', event_type: 'Свадьба', category: 'Инструменталист', budget: 300000, must_keep: ['date', 'budget'] },
  },
];
