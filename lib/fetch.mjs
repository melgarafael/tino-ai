// lib/fetch.mjs
// HTTP text fetcher com timeout + retry exponencial.
// Usa `fetch` global (Node 20+) e `AbortController` para timeout.
//
// API:
//   fetchText(url, { timeoutMs?, retries?, userAgent? }) → Promise<string>
//
// Estrategia:
//   - Timeout via AbortController (default 15s).
//   - Retry exponencial (1s, 2s) para erros de rede ou status >= 500.
//   - Status 4xx NAO retenta (falha do cliente).
//   - Lanca erro estruturado { url, status, reason } no fail final.
//
// User-Agent default: 'tino-ai/0.1' (identificacao transparente pra operadores de feeds).

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_USER_AGENT = 'tino-ai/0.1';
const BACKOFF_BASE_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FetchError extends Error {
  constructor({ url, status, reason }) {
    super(`fetch failed: ${url} → status=${status ?? 'n/a'} reason=${reason}`);
    this.name = 'FetchError';
    this.url = url;
    this.status = status ?? null;
    this.reason = reason;
  }
}

async function fetchOnce(url, { timeoutMs, userAgent }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': userAgent, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
    });
    if (!res.ok) {
      const err = new FetchError({ url, status: res.status, reason: `http ${res.status}` });
      err.retryable = res.status >= 500;
      throw err;
    }
    return await res.text();
  } catch (e) {
    if (e instanceof FetchError) throw e;
    const reason = e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network');
    const err = new FetchError({ url, status: null, reason });
    err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchOnce(url, { timeoutMs, userAgent });
    } catch (e) {
      lastErr = e;
      const retryable = e?.retryable !== false;
      if (!retryable || attempt === retries) break;
      const wait = BACKOFF_BASE_MS * Math.pow(2, attempt); // 1s, 2s, ...
      await sleep(wait);
    }
  }
  throw lastErr ?? new FetchError({ url, status: null, reason: 'unknown' });
}

export { FetchError };
