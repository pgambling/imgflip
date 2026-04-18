const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export function assertSafeBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid baseUrl: ${baseUrl}`);
  }
  if (url.protocol === "https:") return;
  if (url.protocol === "http:") {
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return;
  }
  throw new Error(
    `baseUrl must use HTTPS (got ${url.protocol}//${url.hostname}). ` +
      `HTTP is only permitted for localhost test servers.`,
  );
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Imgflip request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Imgflip request failed: HTTP ${res.status} ${res.statusText}`);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new Error(`Imgflip response too large: ${contentLength} bytes`);
  }

  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Imgflip response too large: ${text.length} bytes`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Imgflip response was not valid JSON (HTTP ${res.status}). ` +
        `First 200 chars: ${text.slice(0, 200)}`,
    );
  }
}

export function redactSecrets(message: string, ...secrets: Array<string | undefined>): string {
  let out = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 3) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  const MAX = 500;
  return out.length > MAX ? `${out.slice(0, MAX)}…` : out;
}
