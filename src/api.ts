import { matchLocal } from './matcher';
import type { MatchQuery, MatchResponse } from './types';

/** The anonymized hackathon CSV is bundled so the MVP works without a server. */
export async function matchContractors(query: MatchQuery, signal?: AbortSignal): Promise<MatchResponse> {
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  await Promise.resolve();
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  return matchLocal(query);
}
