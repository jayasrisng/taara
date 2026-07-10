/**
 * Thin client for TaaraNight's server routes.
 *
 * Reads resolve to `null` rather than throwing: the sky should never stop being
 * playable because a request failed. A lost result is a small sadness; a broken
 * puzzle is a ruined bedtime.
 *
 * Sharing is the exception. It is a deliberate action with a visible outcome, so
 * it reports *why* it failed and the UI can say so.
 */

import type {
  CompleteRequest,
  CompleteResponse,
  ErrorResponse,
  InitResponse,
  LeaderboardsResponse,
  MySkyResponse,
  SharePostResponse,
  ShareResponse,
} from '../shared/api';

/** An outcome the caller is expected to explain to the player. */
export type Attempt<T> = { ok: true; value: T } | { ok: false; message: string };

function isErrorResponse(body: unknown): body is ErrorResponse {
  return typeof body === 'object' && body !== null && typeof (body as ErrorResponse).message === 'string';
}

async function attempt<T>(path: string, init?: RequestInit): Promise<Attempt<T>> {
  try {
    const response = await fetch(path, init);
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message = isErrorResponse(body) ? body.message : `The sky did not answer (${response.status})`;
      return { ok: false, message };
    }
    return { ok: true, value: body as T };
  } catch (error) {
    console.error(`${path} failed:`, error);
    return { ok: false, message: 'The sky is out of reach right now' };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const outcome = await attempt<T>(path, init);
  if (outcome.ok) return outcome.value;
  console.error(`${path}: ${outcome.message}`);
  return null;
}

export function fetchInit(): Promise<InitResponse | null> {
  return request<InitResponse>('/api/init');
}

export function fetchMySky(): Promise<MySkyResponse | null> {
  return request<MySkyResponse>('/api/mysky');
}

export function fetchLeaderboards(): Promise<LeaderboardsResponse | null> {
  return request<LeaderboardsResponse>('/api/leaderboards');
}

export function postComplete(body: CompleteRequest): Promise<CompleteResponse | null> {
  return request<CompleteResponse>('/api/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Ask the server to post tonight's card as a comment. It has no body: the card
 * is composed server-side from what was actually recorded.
 */
export function postShare(): Promise<Attempt<ShareResponse>> {
  return attempt<ShareResponse>('/api/share', { method: 'POST' });
}

export function postSharePost(): Promise<Attempt<SharePostResponse>> {
  return attempt<SharePostResponse>('/api/sharePost', { method: 'POST' });
}
