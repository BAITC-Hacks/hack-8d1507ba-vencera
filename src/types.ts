export interface MatchQuery {
  city: string;
  date: string;
  event_type: string;
  category: string;
  budget: number;
  language?: string;
  duration?: number;
  preference?: string;
  must_keep?: Array<'date' | 'budget' | 'language'>;
}

export interface DataQuality {
  synthetic: boolean;
  city_imputed: boolean;
  price_imputed: boolean;
}

export interface Contractor {
  id: string;
  name: string;
  category: string;
  city: string;
  price: number;
  available: boolean;
  languages: string[];
  maxHours: number | null | undefined;
  explanation: string;
  evidence: string[];
  tradeoffs: string[];
  dataQuality: DataQuality;
  sourceQuote?: string;
  unknowns?: string[];
  followUpQuestion?: string;
}

export interface TraceStep {
  key: string;
  label: string;
  count: number;
}

export interface Relaxation {
  type: 'date' | 'budget' | 'language' | 'duration' | 'city' | 'other';
  description: string;
  value?: string | number;
}

export interface Diagnostics {
  categoryExists: boolean | null;
  totalInCity: number | null;
  rejected: Partial<Record<'busy' | 'over_budget' | 'wrong_event_type' | 'wrong_language' | 'insufficient_duration', number>>;
  bestRelaxation: Relaxation | null;
  alternatives: Relaxation[];
}

export interface MatchResponse {
  status: 'results' | 'category_missing' | 'constraints_blocked' | 'unverified_date';
  query: MatchQuery;
  results: Contractor[];
  count: number;
  decisionTrace: TraceStep[];
  diagnostics: Diagnostics | null;
  isDemo: boolean;
  sensitivity?: string;
  scoringVersion?: string;
}
