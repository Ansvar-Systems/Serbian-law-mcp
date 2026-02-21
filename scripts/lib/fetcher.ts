/**
 * Official source HTTP client for Serbian legislation ingestion.
 *
 * Sources:
 * - https://reg.pravno-informacioni-sistem.rs/api/
 * - https://di.pravno-informacioni-sistem.rs/
 * - https://peng.pravno-informacioni-sistem.rs/api/
 *
 * Includes polite rate limiting (1.2s minimum between requests)
 * and retry logic for transient 429/5xx responses.
 */

const USER_AGENT = 'Ansvar-Serbian-Law-MCP/1.0 (real-data-ingestion)';
const MIN_DELAY_MS = 1200;
const MAX_RETRIES = 3;

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

async function requestWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimit();

    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        ...(init.headers ?? {}),
      },
      redirect: 'follow',
    });

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < retries) {
      const backoffMs = Math.pow(2, attempt + 1) * 1000;
      await sleep(backoffMs);
      continue;
    }

    return response;
  }

  throw new Error(`Failed request after retries: ${url}`);
}

export interface TextResponse {
  status: number;
  url: string;
  contentType: string;
  body: string;
}

export async function fetchText(url: string, accept = 'text/html, application/json, */*'): Promise<TextResponse> {
  const response = await requestWithRetry(url, {
    method: 'GET',
    headers: {
      Accept: accept,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    const snippet = body.slice(0, 240).replace(/\s+/g, ' ').trim();
    throw new Error(`HTTP ${response.status} for ${url}${snippet ? ` -- ${snippet}` : ''}`);
  }

  return {
    status: response.status,
    url: response.url,
    contentType: response.headers.get('content-type') ?? '',
    body,
  };
}

export async function fetchJson<T>(url: string): Promise<T> {
  const result = await fetchText(url, 'application/json, text/plain, */*');
  try {
    return JSON.parse(result.body) as T;
  } catch {
    throw new Error(`Invalid JSON response for ${url}`);
  }
}

export async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const response = await requestWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();

  if (!response.ok) {
    const snippet = body.slice(0, 240).replace(/\s+/g, ' ').trim();
    throw new Error(`HTTP ${response.status} for ${url}${snippet ? ` -- ${snippet}` : ''}`);
  }

  try {
    return JSON.parse(body) as TResponse;
  } catch {
    throw new Error(`Invalid JSON response for ${url}`);
  }
}
